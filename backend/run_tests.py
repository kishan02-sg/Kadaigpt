"""
KadaiGPT - Test Runner Script
Run all tests with coverage report
"""

import subprocess
import sys
import os

# Change to backend directory
os.chdir(os.path.dirname(os.path.abspath(__file__)))

def run_tests():
    """Run all tests with optional coverage"""
    
    print("=" * 60)
    print("🧪 KadaiGPT Test Suite")
    print("=" * 60)
    
    # Check if pytest is installed
    try:
        import pytest
    except ImportError:
        print("❌ pytest not installed. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "pytest", "httpx", "-q"])
    
    # Check if coverage is installed
    use_coverage = False
    try:
        import coverage
        use_coverage = True
    except ImportError:
        print("ℹ️ coverage not installed. Running without coverage.")
    
    print("\n📁 Test files found:")
    test_dir = os.path.join(os.path.dirname(__file__), "tests")
    for f in os.listdir(test_dir):
        if f.startswith("test_") and f.endswith(".py"):
            print(f"   - {f}")
    
    print("\n" + "-" * 60)
    print("Running tests...")
    print("-" * 60 + "\n")
    
    # Run tests
    if use_coverage:
        result = subprocess.run([
            sys.executable, "-m", "pytest",
            "tests/",
            "-v",
            "--tb=short",
            "--cov=app",
            "--cov-report=term-missing"
        ])
    else:
        result = subprocess.run([
            sys.executable, "-m", "pytest",
            "tests/",
            "-v",
            "--tb=short"
        ])
    
    print("\n" + "=" * 60)
    if result.returncode == 0:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed. Check output above.")
    print("=" * 60)
    
    return result.returncode


def run_specific_test(test_file):
    """Run a specific test file"""
    print(f"Running: {test_file}")
    result = subprocess.run([
        sys.executable, "-m", "pytest",
        f"tests/{test_file}",
        "-v",
        "--tb=short"
    ])
    return result.returncode


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Run specific test file
        exit(run_specific_test(sys.argv[1]))
    else:
        # Run all tests
        exit(run_tests())
