# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's **"Report a vulnerability"** button on the repository's Security tab. Do not open a public issue.

Include the affected package and version, a minimal reproduction and the impact you observed. You will receive an acknowledgement, and a fix will be coordinated with you before public disclosure.

## Supported versions

| Version | Security fixes |
| ------- | -------------- |
| 0.1.x   | Yes            |
| < 0.1   | No             |

Until 1.0, only the latest published minor version receives security fixes; the fix ships as a patch release of every package, because all packages share one version number.

## Scope

Of particular interest: any way to get script execution, event handlers, `javascript:` URLs or unsanitized markup into the editor's output.

The server sanitizers (`@viveeditor/sanitize`, `viveeditor/sanitizer`) are in scope: any input whose cleaned output runs script, keeps an event handler or an unsafe URL, loads a frame from a host that is not an enabled embed provider, or changes when cleaned a second time.
