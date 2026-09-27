# Security Policy

## Supported Versions

CodeArena is currently under active development. Security updates are provided for the latest version available on the `main` branch.

| Version | Supported |
| ------- | --------- |
| Latest / main | :white_check_mark: |
| Older versions | :x: |

## Reporting a Vulnerability

If you discover a security vulnerability in CodeArena, please report it responsibly.

**Do not create a public GitHub issue for security vulnerabilities.**

Instead, report the vulnerability privately by contacting:

**Email:** ridhamgupta020@gmail.com

### Please Include

When reporting a vulnerability, provide as much information as possible:

- Description of the vulnerability
- Steps to reproduce the issue
- Affected component or feature
- Potential security impact
- Proof of concept, if available
- Screenshots or logs, if relevant

Please do not include passwords, API keys, tokens, or other sensitive personal information in the report.

## What to Expect

After submitting a security report:

1. The CodeArena maintainers will review the report.
2. We will acknowledge the report when possible.
3. Additional information may be requested if required.
4. The vulnerability will be investigated and assessed.
5. If confirmed, appropriate steps will be taken to address the issue.
6. A security update may be released when appropriate.

Please allow reasonable time for investigation and remediation before publicly disclosing the vulnerability.

## Responsible Disclosure

We ask security researchers and contributors to give the maintainers reasonable time to investigate and address reported vulnerabilities before publicly disclosing them.

Security testing must not intentionally:

- Access another user's private data
- Destroy or modify data
- Disrupt CodeArena services
- Attack external systems
- Attempt to gain unauthorized access to infrastructure

## Scope

Security reports may include issues affecting:

- Code execution sandbox
- Authentication and authorization
- API endpoints
- Database access
- User data
- Contest and assessment systems
- WebSocket connections
- Frontend security
- Backend services
- Docker execution environment
- Dependency vulnerabilities
- Configuration and deployment security

## Security Best Practices for Contributors

Contributors should:

- Never commit passwords or API keys.
- Never commit `.env` or `.env.local` files.
- Never expose database credentials.
- Never expose JWT secrets.
- Validate user input.
- Use secure authentication practices.
- Keep dependencies updated.
- Follow the principle of least privilege.
- Never execute untrusted code directly on the host system.

## Contact

For security-related issues:

**CodeArena Maintainers**

**Email:** ridhamgupta020@gmail.com

Thank you for helping keep CodeArena and its users secure.
