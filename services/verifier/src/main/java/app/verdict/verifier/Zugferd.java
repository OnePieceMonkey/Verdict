package app.verdict.verifier;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

/**
 * ZUGFeRD (VER-06) through the Mustang CLI, run as a child process. Mustang bundles its own
 * Saxon and PDF stack; a separate JVM keeps it off the KoSIT validator's classpath.
 */
final class Zugferd {

  /** Result of Mustang's own validation: PDF/A conformance, XMP metadata and embedded XML. */
  record Validation(boolean valid, List<String> messages) {}

  private static final long STEP_TIMEOUT_S = 90;

  private final Path jar;
  private final String javaBin;
  /** One Mustang JVM at a time keeps the container's memory bounded. */
  private final Semaphore slot = new Semaphore(1);

  Zugferd(Path jar) {
    this.jar = jar;
    this.javaBin = ProcessHandle.current().info().command().orElse("java");
  }

  boolean available() {
    return Files.isReadable(jar);
  }

  /**
   * Renders the CII as a PDF/A-3 (German visualization) and embeds the same XML as a ZUGFeRD 2
   * file with profile XRECHNUNG. The caller has already validated the XML with KoSIT.
   */
  byte[] combine(byte[] ciiXml) throws IOException, InterruptedException {
    return withSlot(
        dir -> {
          Files.write(dir.resolve("invoice.xml"), ciiXml);
          run(dir, "--action", "pdf", "--language", "de", "--source", "invoice.xml", "--out", "visual.pdf");
          run(
              dir,
              "--action", "combine",
              "--source", "visual.pdf",
              "--source-xml", "invoice.xml",
              "--out", "zugferd.pdf",
              "--format", "zf",
              "--version", "2",
              "--profile", "X",
              "--no-additional-attachments");
          return Files.readAllBytes(dir.resolve("zugferd.pdf"));
        });
  }

  Validation validate(byte[] pdf) throws IOException, InterruptedException {
    return withSlot(
        dir -> {
          Files.write(dir.resolve("candidate.pdf"), pdf);
          String report = runForStdout(dir, "--action", "validate", "--source", "candidate.pdf", "--no-notices");
          return parseReport(report);
        });
  }

  private interface Step<T> {
    T apply(Path dir) throws IOException, InterruptedException;
  }

  private <T> T withSlot(Step<T> step) throws IOException, InterruptedException {
    slot.acquire();
    Path dir = Files.createTempDirectory("zugferd-");
    try {
      return step.apply(dir);
    } finally {
      slot.release();
      try (Stream<Path> files = Files.walk(dir)) {
        files.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
      }
    }
  }

  private void run(Path dir, String... args) throws IOException, InterruptedException {
    String out = args[java.util.Arrays.asList(args).indexOf("--out") + 1];
    execute(dir, args);
    // Mustang can print "Written to" and exit 0 after an exception, so trust only the file.
    if (!Files.isRegularFile(dir.resolve(out)) || Files.size(dir.resolve(out)) == 0) {
      throw new IOException("mustang " + args[1] + " produced no output");
    }
  }

  private String runForStdout(Path dir, String... args) throws IOException, InterruptedException {
    execute(dir, args);
    return Files.readString(dir.resolve("stdout.txt"), StandardCharsets.UTF_8);
  }

  private void execute(Path dir, String... args) throws IOException, InterruptedException {
    // Each step is a short-lived JVM: the C1 compiler and serial GC start about twice as fast.
    List<String> cmd =
        new ArrayList<>(
            List.of(javaBin, "-Xmx512m", "-XX:TieredStopAtLevel=1", "-XX:+UseSerialGC", "-jar", jar.toString()));
    cmd.addAll(List.of(args));
    cmd.add("--disable-file-logging");
    Process p =
        new ProcessBuilder(cmd)
            .directory(dir.toFile())
            .redirectOutput(dir.resolve("stdout.txt").toFile())
            .redirectError(dir.resolve("stderr.txt").toFile())
            .start();
    if (!p.waitFor(STEP_TIMEOUT_S, TimeUnit.SECONDS)) {
      p.destroyForcibly();
      throw new IOException("mustang " + args[1] + " timed out");
    }
  }

  /** Mustang's report: the root's own summary is the overall verdict; errors are collected. */
  static Validation parseReport(String report) {
    int start = report.indexOf("<validation");
    if (start < 0) return new Validation(false, List.of("no validation report"));
    try {
      DocumentBuilderFactory f = DocumentBuilderFactory.newDefaultInstance();
      f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
      f.setExpandEntityReferences(false);
      Document doc =
          f.newDocumentBuilder()
              .parse(new java.io.ByteArrayInputStream(report.substring(start).getBytes(StandardCharsets.UTF_8)));
      Element root = doc.getDocumentElement();
      boolean valid = false;
      for (Node n = root.getFirstChild(); n != null; n = n.getNextSibling()) {
        if (n instanceof Element e && "summary".equals(e.getTagName())) {
          valid = "valid".equals(e.getAttribute("status"));
        }
      }
      List<String> messages = new ArrayList<>();
      for (String tag : List.of("error", "exception")) {
        NodeList list = root.getElementsByTagName(tag);
        for (int i = 0; i < list.getLength(); i++) messages.add(list.item(i).getTextContent().strip());
      }
      return new Validation(valid, messages);
    } catch (Exception e) {
      return new Validation(false, List.of("unreadable validation report: " + e.getClass().getSimpleName()));
    }
  }
}
