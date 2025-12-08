# BookEx AI Agent Rules

## Overview

This directory contains comprehensive rules and constraints for all AI agents working on the BookEx project. These rules are derived from the official Software Requirements Specification (SRS) document and **MUST** be strictly followed to ensure system integrity and functionality.

## Purpose

These rules serve to:
- Prevent AI agents from altering intended system functionality
- Enforce compliance with the approved SRS document
- Maintain consistency across all development activities
- Ensure security, performance, and quality standards
- Preserve the architectural integrity of the BookEx platform

## Document Structure

1. **01_CORE_SYSTEM_CONSTRAINTS.md** - Fundamental system boundaries and restrictions
2. **02_FUNCTIONAL_REQUIREMENTS.md** - Use case implementations and business logic rules
3. **03_NON_FUNCTIONAL_REQUIREMENTS.md** - Performance, security, and quality standards
4. **04_DATA_MODEL_ARCHITECTURE.md** - Database schema and architectural patterns
5. **05_SECURITY_COMPLIANCE.md** - Security protocols and regulatory compliance
6. **06_TECHNOLOGY_STACK.md** - Approved technologies and integration standards

## Critical Instructions for AI Agents

### MANDATORY COMPLIANCE

⚠️ **All AI agents MUST:**
- Read and understand ALL documents in this directory before making any code changes
- Reference specific SRS sections when implementing features
- Never deviate from defined use cases and workflows
- Preserve all existing security measures and access controls
- Maintain backward compatibility unless explicitly approved
- Document any ambiguities or conflicts for human review

### FORBIDDEN ACTIONS

🚫 **AI agents are PROHIBITED from:**
- Modifying core authentication and authorization logic without explicit approval
- Changing database schema without validating against ERD
- Removing or bypassing security checks and validations
- Altering API contracts that would break existing integrations
- Implementing features not specified in the SRS
- Disabling rate limiting, content moderation, or audit logging

## Version Control

- SRS Version: Phase 1
- Last Updated: December 9, 2025
- Review Status: Approved

## Getting Help

If any AI agent encounters:
- Contradictions between rules
- Ambiguous requirements
- Missing specifications
- Technical impossibilities

**STOP immediately** and flag for human review. Do not proceed with assumptions.

## Compliance Verification

Before submitting any code changes, verify:
- [ ] All relevant rules have been reviewed
- [ ] Implementation matches specified use cases
- [ ] No security measures have been weakened
- [ ] Database integrity is maintained
- [ ] Non-functional requirements are met
- [ ] Tests cover the new functionality
- [ ] Documentation has been updated

---

**Remember:** These rules exist to protect the integrity of the BookEx system and ensure a consistent, secure user experience. When in doubt, always err on the side of caution and seek human guidance.
