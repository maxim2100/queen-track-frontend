#!/bin/bash

# Comprehensive test script for Queen Track Frontend
# Usage: ./scripts/test.sh [test-type]

set -e

# Configuration
TEST_TYPES=("unit" "integration" "lint" "coverage" "all")
DEFAULT_TEST="all"
TEST_TYPE=${1:-$DEFAULT_TEST}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Validate test type
if [[ ! " ${TEST_TYPES[@]} " =~ " ${TEST_TYPE} " ]]; then
    log_error "Invalid test type: $TEST_TYPE"
    echo "Available test types: ${TEST_TYPES[*]}"
    exit 1
fi

echo "🧪 Starting test suite: $TEST_TYPE"

# Setup test environment
setup_test_env() {
    log_info "Setting up test environment..."
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi
    
    # Create coverage directory
    mkdir -p coverage
    
    log_success "Test environment ready"
}

# Run linting tests
run_lint_tests() {
    log_info "Running ESLint..."
    
    npm run lint 2>&1 | tee lint-results.txt
    LINT_EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $LINT_EXIT_CODE -eq 0 ]; then
        log_success "Linting passed"
        rm -f lint-results.txt
    else
        log_error "Linting failed"
        log_info "Lint errors saved to lint-results.txt"
        return 1
    fi
}

# Run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    # Run tests with coverage
    npm run test:ci
    
    if [ $? -eq 0 ]; then
        log_success "Unit tests passed"
    else
        log_error "Unit tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    # Run integration tests specifically
    npm test -- --testPathPattern="integration" --watchAll=false --coverage=false
    
    if [ $? -eq 0 ]; then
        log_success "Integration tests passed"
    else
        log_error "Integration tests failed"
        return 1
    fi
}

# Generate coverage report
run_coverage_tests() {
    log_info "Generating coverage report..."
    
    npm run test:coverage
    
    if [ $? -eq 0 ]; then
        log_success "Coverage report generated"
        
        # Check coverage thresholds
        if [ -f "coverage/lcov-report/index.html" ]; then
            log_info "Coverage report available at: coverage/lcov-report/index.html"
        fi
        
        # Extract coverage percentage
        if command -v lcov >/dev/null 2>&1; then
            COVERAGE=$(lcov --summary coverage/lcov.info 2>/dev/null | grep -o '[0-9]*\.[0-9]*%' | head -1 || echo "N/A")
            log_info "Total coverage: $COVERAGE"
        fi
    else
        log_error "Coverage generation failed"
        return 1
    fi
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Build the application first
    npm run build
    
    if [ $? -eq 0 ]; then
        log_success "Build successful for smoke tests"
        
        # Start a temporary server for testing
        npm run serve &
        SERVER_PID=$!
        
        # Wait for server to start
        sleep 10
        
        # Test basic endpoints
        if curl -f http://localhost:3000 >/dev/null 2>&1; then
            log_success "Smoke test: Homepage accessible"
        else
            log_error "Smoke test: Homepage not accessible"
            kill $SERVER_PID 2>/dev/null
            return 1
        fi
        
        # Test health endpoint
        if curl -f http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Smoke test: Health check passed"
        else
            log_warning "Smoke test: Health endpoint not available (may be expected)"
        fi
        
        # Kill the server
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
        
        log_success "Smoke tests completed"
    else
        log_error "Build failed for smoke tests"
        return 1
    fi
}

# Run security audit
run_security_audit() {
    log_info "Running security audit..."
    
    npm audit --audit-level high
    AUDIT_EXIT_CODE=$?
    
    if [ $AUDIT_EXIT_CODE -eq 0 ]; then
        log_success "Security audit passed"
    else
        log_warning "Security audit found issues (exit code: $AUDIT_EXIT_CODE)"
        log_info "Review the output above for security recommendations"
        # Don't fail the build for audit issues, just warn
    fi
}

# Main test execution
main() {
    setup_test_env
    
    case $TEST_TYPE in
        "lint")
            run_lint_tests
            ;;
        "unit")
            run_unit_tests
            ;;
        "integration")
            run_integration_tests
            ;;
        "coverage")
            run_coverage_tests
            ;;
        "all")
            # Run all tests in sequence
            run_lint_tests || exit 1
            run_unit_tests || exit 1
            run_integration_tests || exit 1
            run_coverage_tests || exit 1
            run_smoke_tests || exit 1
            run_security_audit
            ;;
    esac
    
    log_success "All tests for '$TEST_TYPE' completed successfully!"
}

# Performance testing (optional)
run_performance_tests() {
    log_info "Running performance tests..."
    
    if command -v lighthouse >/dev/null 2>&1; then
        # Start server for performance testing
        npm run serve &
        SERVER_PID=$!
        sleep 10
        
        # Run Lighthouse
        lighthouse http://localhost:3000 --output json --output-path ./lighthouse-report.json --chrome-flags="--headless"
        
        if [ $? -eq 0 ]; then
            log_success "Performance audit completed"
            log_info "Lighthouse report saved to lighthouse-report.json"
        else
            log_warning "Performance audit failed"
        fi
        
        kill $SERVER_PID 2>/dev/null
        wait $SERVER_PID 2>/dev/null
    else
        log_warning "Lighthouse not installed, skipping performance tests"
    fi
}

# Generate test summary
generate_test_summary() {
    echo ""
    echo "📊 Test Summary"
    echo "==============="
    echo "Test Type: $TEST_TYPE"
    echo "Timestamp: $(date)"
    echo "Node Version: $(node --version)"
    echo "NPM Version: $(npm --version)"
    
    if [ -f "coverage/coverage-summary.json" ]; then
        echo "Coverage Summary:"
        node -e "
            const coverage = require('./coverage/coverage-summary.json');
            console.log('  Lines: ' + coverage.total.lines.pct + '%');
            console.log('  Functions: ' + coverage.total.functions.pct + '%');
            console.log('  Branches: ' + coverage.total.branches.pct + '%');
            console.log('  Statements: ' + coverage.total.statements.pct + '%');
        " 2>/dev/null || echo "  Coverage data not available"
    fi
    
    echo ""
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null
    # Remove temporary files
    rm -f lint-results.txt
}

# Set up cleanup trap
trap cleanup EXIT

# Run main function
main

# Generate summary
generate_test_summary

exit 0 