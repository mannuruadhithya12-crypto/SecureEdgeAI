#!/bin/bash

# Merge script for SecureEdgeAI branches into main
# This script merges all unique feature branches into main, avoiding duplicates

set -e

echo "========================================"
echo "SecureEdgeAI Branch Merge Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MAIN_BRANCH="main"
BRANCHES_TO_MERGE=(
    "feature/backend"
    "feature/ai"
    "codex/organize-mobile"
)

# Verify we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo -e "${YELLOW}Current branch: $CURRENT_BRANCH${NC}"
echo ""

# Check if main branch exists
if ! git show-ref --verify --quiet refs/heads/$MAIN_BRANCH; then
    echo -e "${RED}Error: Main branch '$MAIN_BRANCH' not found${NC}"
    exit 1
fi

# Confirm before proceeding
echo -e "${YELLOW}This script will:${NC}"
echo "1. Fetch latest changes from origin"
echo "2. Check out main branch"
echo "3. Merge the following branches into main (one by one):"
for branch in "${BRANCHES_TO_MERGE[@]}"; do
    echo "   - $branch"
done
echo ""
echo -e "${YELLOW}WARNING: Make sure you have a backup or clean git state before proceeding!${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Merge cancelled."
    exit 1
fi

echo ""
echo -e "${GREEN}Starting merge process...${NC}"
echo ""

# Fetch latest changes
echo "Fetching latest changes from origin..."
git fetch origin

# Checkout main branch
echo "Checking out $MAIN_BRANCH branch..."
git checkout $MAIN_BRANCH
git pull origin $MAIN_BRANCH

echo ""

# Merge each branch
MERGE_COUNT=0
MERGE_FAILED=0

for branch in "${BRANCHES_TO_MERGE[@]}"; do
    echo "========================================"
    echo "Merging: $branch"
    echo "========================================"
    
    # Verify branch exists
    if ! git show-ref --verify --quiet refs/heads/$branch; then
        echo -e "${RED}⚠ Branch '$branch' not found locally, attempting to fetch...${NC}"
        if ! git show-ref --verify --quiet refs/remotes/origin/$branch; then
            echo -e "${RED}✗ Branch 'origin/$branch' not found on remote. Skipping.${NC}"
            ((MERGE_FAILED++))
            echo ""
            continue
        fi
        git checkout -b $branch origin/$branch
    fi
    
    # Check if branch is already merged
    if git merge-base --is-ancestor $branch $MAIN_BRANCH; then
        echo -e "${GREEN}✓ Branch '$branch' is already merged into $MAIN_BRANCH. Skipping.${NC}"
        ((MERGE_COUNT++))
        echo ""
        continue
    fi
    
    # Attempt merge
    if git merge $branch --no-edit; then
        echo -e "${GREEN}✓ Successfully merged '$branch' into $MAIN_BRANCH${NC}"
        ((MERGE_COUNT++))
    else
        echo -e "${RED}✗ Merge conflict detected in '$branch'${NC}"
        echo "Please resolve conflicts manually:"
        echo "  1. Run: git status  (to see conflicting files)"
        echo "  2. Edit files to resolve conflicts"
        echo "  3. Run: git add <resolved-files>"
        echo "  4. Run: git commit -m 'Resolve conflicts from $branch'"
        echo ""
        read -p "Continue with next branch after resolving conflicts? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Merge process stopped."
            exit 1
        fi
        ((MERGE_FAILED++))
    fi
    
    echo ""
done

echo "========================================"
echo "Merge Summary"
echo "========================================"
echo -e "${GREEN}Successfully merged: $MERGE_COUNT branches${NC}"
if [ $MERGE_FAILED -gt 0 ]; then
    echo -e "${RED}Failed/Skipped: $MERGE_FAILED branches${NC}"
fi
echo ""

# Final status
echo "Current status on $MAIN_BRANCH:"
git log --oneline -10

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review merged changes: git log --oneline origin/$MAIN_BRANCH..$MAIN_BRANCH"
echo "2. Test the merged code locally"
echo "3. Push to remote: git push origin $MAIN_BRANCH"
echo ""

echo -e "${GREEN}Merge script completed!${NC}"
