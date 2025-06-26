#!/usr/bin/env python3
"""
Knowledge Helper for 2SEARX2COOL Integration
Helps find documentation and understand complex parts
"""

import os
import re
import json
from pathlib import Path
from typing import List, Dict, Optional
import subprocess

class KnowledgeHelper:
    def __init__(self, project_root: str):
        self.project_root = Path(project_root)
        self.knowledge_base = {}
        self.unclear_items = []
        
    def find_documentation(self, topic: str) -> List[Dict]:
        """Find documentation related to a topic"""
        docs = []
        
        # Search in markdown files
        for md_file in self.project_root.rglob("*.md"):
            try:
                content = md_file.read_text()
                if topic.lower() in content.lower():
                    # Extract relevant section
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if topic.lower() in line.lower():
                            context = '\n'.join(lines[max(0, i-2):min(len(lines), i+10)])
                            docs.append({
                                'file': str(md_file.relative_to(self.project_root)),
                                'line': i + 1,
                                'context': context
                            })
            except:
                pass
                
        # Search in code comments
        for py_file in self.project_root.rglob("*.py"):
            try:
                content = py_file.read_text()
                # Look for docstrings and comments
                if topic.lower() in content.lower():
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        if '"""' in line or '#' in line:
                            if topic.lower() in line.lower():
                                context = '\n'.join(lines[max(0, i-1):min(len(lines), i+5)])
                                docs.append({
                                    'file': str(py_file.relative_to(self.project_root)),
                                    'line': i + 1,
                                    'context': context
                                })
            except:
                pass
                
        return docs
        
    def analyze_file_purpose(self, filepath: str) -> Dict:
        """Analyze a file to understand its purpose"""
        file_path = Path(filepath)
        analysis = {
            'file': filepath,
            'purpose': 'unknown',
            'dependencies': [],
            'exports': [],
            'key_functions': []
        }
        
        if not file_path.exists():
            return analysis
            
        try:
            content = file_path.read_text()
            
            # Extract file purpose from docstring
            docstring_match = re.search(r'"""(.*?)"""', content, re.DOTALL)
            if docstring_match:
                analysis['purpose'] = docstring_match.group(1).strip().split('\n')[0]
                
            # Find imports
            imports = re.findall(r'^(?:from|import)\s+(\S+)', content, re.MULTILINE)
            analysis['dependencies'] = list(set(imports))
            
            # Find class/function definitions
            classes = re.findall(r'^class\s+(\w+)', content, re.MULTILINE)
            functions = re.findall(r'^def\s+(\w+)', content, re.MULTILINE)
            analysis['exports'] = classes + functions
            analysis['key_functions'] = functions[:5]  # Top 5 functions
            
        except:
            pass
            
        return analysis
        
    def trace_import_path(self, module_name: str) -> List[str]:
        """Trace where a module is imported from"""
        paths = []
        
        # Search for module definition
        for py_file in self.project_root.rglob("*.py"):
            try:
                if py_file.stem == module_name or f"/{module_name}/" in str(py_file):
                    paths.append(str(py_file.relative_to(self.project_root)))
            except:
                pass
                
        # Search for __init__.py files that might define the module
        for init_file in self.project_root.rglob("__init__.py"):
            try:
                content = init_file.read_text()
                if module_name in content:
                    paths.append(f"{init_file.parent.relative_to(self.project_root)}/__init__.py")
            except:
                pass
                
        return paths
        
    def identify_unclear_areas(self) -> List[Dict]:
        """Identify areas that need clarification"""
        unclear = []
        
        # Check for complex configurations
        for config_file in self.project_root.rglob("*.yml"):
            try:
                content = config_file.read_text()
                if content.count('\n') > 100:  # Large config file
                    unclear.append({
                        'type': 'complex_config',
                        'file': str(config_file.relative_to(self.project_root)),
                        'reason': 'Large configuration file that needs understanding'
                    })
            except:
                pass
                
        # Check for circular imports
        import_map = {}
        for py_file in self.project_root.rglob("*.py"):
            try:
                content = py_file.read_text()
                imports = re.findall(r'^(?:from|import)\s+(\S+)', content, re.MULTILINE)
                import_map[str(py_file)] = imports
            except:
                pass
                
        # Add more unclear area detection logic here
        
        return unclear
        
    def generate_questions(self) -> List[str]:
        """Generate questions that need answering"""
        questions = []
        
        # Questions about directory structure
        if (self.project_root / "searxng-core").exists():
            questions.append("Why is searxng-core in a separate directory?")
            
        # Questions about virtual environments
        venvs = list(self.project_root.glob("*venv*"))
        if len(venvs) > 1:
            questions.append(f"Why are there {len(venvs)} virtual environments?")
            
        # Questions about configurations
        configs = list(self.project_root.glob("config/*.yml"))
        for config in configs:
            questions.append(f"What is the purpose of {config.name}?")
            
        # Questions about services
        questions.extend([
            "How do services verify each other is running?",
            "What is the exact startup sequence and timing?",
            "How are errors handled during startup?",
            "What happens if a service fails to start?"
        ])
        
        return questions
        
    def create_investigation_report(self, output_file: str):
        """Create a comprehensive investigation report"""
        report = {
            'documentation_found': {},
            'unclear_areas': self.identify_unclear_areas(),
            'questions_to_answer': self.generate_questions(),
            'recommendations': []
        }
        
        # Add recommendations based on findings
        report['recommendations'] = [
            "Review startup scripts in detail to understand sequencing",
            "Map out all configuration files and their purposes",
            "Understand the virtual environment strategy",
            "Document all inter-service dependencies",
            "Create a service dependency graph"
        ]
        
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2)
            
        return report

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Knowledge Helper for 2SEARX2COOL Integration')
    parser.add_argument('action', choices=['find', 'analyze', 'trace', 'questions', 'report'],
                        help='Action to perform')
    parser.add_argument('--topic', help='Topic to search for')
    parser.add_argument('--file', help='File to analyze')
    parser.add_argument('--module', help='Module to trace')
    parser.add_argument('--output', default='knowledge-report.json', help='Output file for report')
    parser.add_argument('--root', default='/home/mik/SEARXNG/2SEARX2COOL', 
                        help='Project root directory')
    
    args = parser.parse_args()
    
    helper = KnowledgeHelper(args.root)
    
    if args.action == 'find' and args.topic:
        docs = helper.find_documentation(args.topic)
        print(f"\n📚 Documentation for '{args.topic}':")
        for doc in docs[:5]:  # Show top 5 results
            print(f"\n📄 {doc['file']}:{doc['line']}")
            print("─" * 40)
            print(doc['context'])
            
    elif args.action == 'analyze' and args.file:
        analysis = helper.analyze_file_purpose(args.file)
        print(f"\n🔍 Analysis of {args.file}:")
        print(f"Purpose: {analysis['purpose']}")
        print(f"Dependencies: {', '.join(analysis['dependencies'][:5])}")
        print(f"Key Functions: {', '.join(analysis['key_functions'])}")
        
    elif args.action == 'trace' and args.module:
        paths = helper.trace_import_path(args.module)
        print(f"\n📍 Module '{args.module}' found in:")
        for path in paths:
            print(f"  - {path}")
            
    elif args.action == 'questions':
        questions = helper.generate_questions()
        print("\n❓ Questions to Answer:")
        for i, q in enumerate(questions, 1):
            print(f"{i}. {q}")
            
    elif args.action == 'report':
        report = helper.create_investigation_report(args.output)
        print(f"\n📊 Investigation report saved to: {args.output}")
        print(f"Unclear areas found: {len(report['unclear_areas'])}")
        print(f"Questions generated: {len(report['questions_to_answer'])}")

if __name__ == "__main__":
    main()