package app.verdict.verifier;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import de.kosit.validationtool.api.AcceptRecommendation;
import de.kosit.validationtool.api.Check;
import de.kosit.validationtool.api.Configuration;
import de.kosit.validationtool.api.Input;
import de.kosit.validationtool.api.InputFactory;
import de.kosit.validationtool.api.Result;
import de.kosit.validationtool.impl.DefaultCheck;
import de.kosit.validationtool.impl.xml.ProcessorProvider;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.StringReader;
import java.io.StringWriter;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.Executors;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

/**
 * Internal verifier service. Wraps the official KoSIT validator with the XRechnung configuration.
 * The validator verdict is the ground truth for the whole pipeline, so this service never
 * interprets or softens results: it only reshapes the VARL report into JSON.
 */
public final class VerifierServer {

  private static final String VARL_NS = "http://www.xoev.de/de/validator/varl/1";
  private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;

  private final Check check;
  private final byte[] secret;
  private final String versionsJson;

  private VerifierServer(Check check, byte[] secret, String versionsJson) {
    this.check = check;
    this.secret = secret;
    this.versionsJson = versionsJson;
  }

  public static void main(String[] args) throws Exception {
    String secret = System.getenv("VERIFIER_SECRET");
    if (secret == null || secret.length() < 16) {
      // Fail closed: an unprotected verifier must never start.
      System.err.println("VERIFIER_SECRET must be set (min. 16 characters)");
      System.exit(1);
    }
    Path configDir = Path.of(env("XRECHNUNG_CONFIG_DIR", "/opt/xrechnung-config"));
    int port = Integer.parseInt(env("PORT", "8081"));

    String versions =
        "{\"validator\":"
            + Json.str(env("KOSIT_VALIDATOR_VERSION", "unknown"))
            + ",\"configuration\":"
            + Json.str(env("XRECHNUNG_CONFIG_VERSION", "unknown"))
            + "}";

    long t0 = System.nanoTime();
    Configuration config =
        Configuration.load(configDir.resolve("scenarios.xml").toUri(), configDir.toUri())
            .build(ProcessorProvider.getProcessor());
    Check check = new DefaultCheck(config);
    System.out.printf("KoSIT configuration loaded in %d ms%n", (System.nanoTime() - t0) / 1_000_000);

    VerifierServer app = new VerifierServer(check, secret.getBytes(StandardCharsets.UTF_8), versions);
    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
    server.createContext("/health", app::health);
    server.createContext("/v1/validate/xrechnung", app::validateXRechnung);
    server.start();
    System.out.printf("verifier listening on :%d%n", port);
  }

  private void health(HttpExchange ex) throws IOException {
    // Liveness only, no data and no validation: safe without the secret.
    send(ex, 200, "{\"status\":\"ok\"}");
  }

  private void validateXRechnung(HttpExchange ex) throws IOException {
    try (ex) {
      if (!"POST".equals(ex.getRequestMethod())) {
        send(ex, 405, Json.error("method not allowed"));
        return;
      }
      if (!authorized(ex)) {
        send(ex, 401, Json.error("unauthorized"));
        return;
      }
      byte[] body = readLimited(ex.getRequestBody());
      if (body == null) {
        send(ex, 413, Json.error("payload too large"));
        return;
      }
      if (body.length == 0) {
        send(ex, 400, Json.error("empty body"));
        return;
      }
      Input input = InputFactory.read(body, "invoice.xml");
      Result result = check.checkInput(input);
      send(ex, 200, toJson(result));
    } catch (Exception e) {
      send(ex, 500, Json.error("validation failed: " + e.getClass().getSimpleName()));
    }
  }

  private String toJson(Result result) throws Exception {
    List<String> findings = new ArrayList<>();
    String reportXml = null;
    String reportHash = null;
    Document report = result.isProcessingSuccessful() ? result.getReportDocument() : null;

    if (report != null) {
      reportXml = serialize(report);
      reportHash = sha256Hex(reportXml.getBytes(StandardCharsets.UTF_8));
      // The validator hands out a Saxon-backed DOM view whose getElementsByTagNameNS finds
      // nothing. Re-parse the serialized report with the JDK parser to read the messages.
      NodeList messages = parseSecure(reportXml).getElementsByTagNameNS(VARL_NS, "message");
      for (int i = 0; i < messages.getLength(); i++) {
        Element m = (Element) messages.item(i);
        findings.add(
            "{\"ruleId\":"
                + Json.str(m.getAttribute("code"))
                + ",\"severity\":"
                + Json.str(m.getAttribute("level"))
                + ",\"message\":"
                + Json.str(m.getTextContent().strip())
                + ",\"location\":"
                + Json.str(m.getAttribute("xpathLocation"))
                + "}");
      }
    } else {
      for (String err : result.getProcessingErrors()) {
        findings.add(
            "{\"ruleId\":\"PROCESSING\",\"severity\":\"error\",\"message\":"
                + Json.str(err)
                + ",\"location\":\"\"}");
      }
    }

    AcceptRecommendation rec = result.getAcceptRecommendation();
    boolean valid = rec == AcceptRecommendation.ACCEPTABLE;
    return "{\"valid\":"
        + valid
        + ",\"acceptRecommendation\":"
        + Json.str(rec == null ? "UNDEFINED" : rec.name())
        + ",\"schemaValid\":"
        + result.isSchemaValid()
        + ",\"schematronValid\":"
        + result.isSchematronValid()
        + ",\"errors\":["
        + String.join(",", findings)
        + "],\"reportHash\":"
        + (reportHash == null ? "null" : Json.str(reportHash))
        + ",\"report\":"
        + (reportXml == null ? "null" : Json.str(reportXml))
        + ",\"versions\":"
        + versionsJson
        + "}";
  }

  private boolean authorized(HttpExchange ex) {
    String given = ex.getRequestHeaders().getFirst("X-Verifier-Secret");
    if (given == null) return false;
    return MessageDigest.isEqual(secret, given.getBytes(StandardCharsets.UTF_8));
  }

  private static byte[] readLimited(InputStream in) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] buf = new byte[8192];
    int n;
    while ((n = in.read(buf)) != -1) {
      if (out.size() + n > MAX_BODY_BYTES) return null;
      out.write(buf, 0, n);
    }
    return out.toByteArray();
  }

  private static String serialize(Document doc) throws Exception {
    var t = TransformerFactory.newInstance().newTransformer();
    t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
    StringWriter w = new StringWriter();
    t.transform(new DOMSource(doc), new StreamResult(w));
    return w.toString();
  }

  private static Document parseSecure(String xml) throws Exception {
    DocumentBuilderFactory f = DocumentBuilderFactory.newDefaultInstance();
    f.setNamespaceAware(true);
    f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    f.setXIncludeAware(false);
    f.setExpandEntityReferences(false);
    return f.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
  }

  private static String sha256Hex(byte[] data) throws NoSuchAlgorithmException {
    return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
  }

  private static void send(HttpExchange ex, int status, String json) throws IOException {
    byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
    ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    ex.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = ex.getResponseBody()) {
      os.write(bytes);
    }
  }

  private static String env(String key, String fallback) {
    String v = System.getenv(key);
    return v == null || v.isBlank() ? fallback : v;
  }

  /** Minimal JSON string encoding; keeps the service free of extra dependencies. */
  static final class Json {
    static String str(String s) {
      StringBuilder b = new StringBuilder(s.length() + 2).append('"');
      for (char c : s.toCharArray()) {
        switch (c) {
          case '"' -> b.append("\\\"");
          case '\\' -> b.append("\\\\");
          case '\n' -> b.append("\\n");
          case '\r' -> b.append("\\r");
          case '\t' -> b.append("\\t");
          default -> {
            if (c < 0x20) b.append(String.format("\\u%04x", (int) c));
            else b.append(c);
          }
        }
      }
      return b.append('"').toString();
    }

    static String error(String msg) {
      return "{\"error\":" + str(msg) + "}";
    }
  }
}
