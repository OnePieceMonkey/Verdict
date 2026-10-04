---
title: Verdict
emoji: 🧾
colorFrom: indigo
colorTo: green
sdk: docker
app_port: 7860
pinned: false
license: apache-2.0
short_description: PDF invoice to valid XRechnung. Nemotron proposes, KoSIT decides.
---

# Verdict

Verdict turns a German PDF invoice into an XRechnung (EN 16931, CII). NVIDIA Nemotron
models on Nebius Token Factory extract and repair; the official KoSIT validator decides.
A file is only stamped "verified" when the validator accepts it.

This Space runs the web app and the validator in one container. Use the gallery to replay
recorded runs at no cost, or upload a synthetic invoice for a live run.

Source: https://github.com/OnePieceMonkey/Verdict
