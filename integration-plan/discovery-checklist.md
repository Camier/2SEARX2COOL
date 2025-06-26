# Discovery Phase Checklist

## Discovery Worker 1: System Structure Mapping
- [ ] Map directory structure of working 2SEARX2COOL
- [ ] Identify searxng-core setup and why it's separate
- [ ] Document all Python packages and their locations
- [ ] Map all configuration file locations
- [ ] Identify all log file locations

## Discovery Worker 2: Configuration Audit
- [ ] List all YAML/JSON configuration files
- [ ] Document all environment variables used
- [ ] Identify all port assignments
- [ ] Map service URLs and endpoints
- [ ] Document all API keys and credentials needed

## Discovery Worker 3: Dependency Analysis
- [ ] List all Python requirements for each service
- [ ] Document virtual environment setups
- [ ] Map import structures and PYTHONPATH needs
- [ ] Identify shared libraries and modules
- [ ] Document version constraints

## Discovery Worker 4: Architecture Documentation
- [ ] Document service startup sequence
- [ ] Map inter-service communication
- [ ] Identify health check mechanisms
- [ ] Document data flow between components
- [ ] Create architecture diagrams

## Gate 1 Success Criteria
- [ ] Can explain why original uses specific directory structure
- [ ] Have complete list of all dependencies
- [ ] Understand all configuration requirements
- [ ] Can diagram the complete system architecture
- [ ] Have identified all potential failure points