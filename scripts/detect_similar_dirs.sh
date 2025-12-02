#!/bin/bash
# Script to detect similar/duplicate directories in a project
# Usage: ./detect_similar_dirs.sh [directory]

set -e

TARGET_DIR="${1:-.}"
SIMILARITY_THRESHOLD=0.7  # 70% similarity threshold

echo "=== Directory Similarity Detection Tool ==="
echo "Scanning: $TARGET_DIR"
echo ""

# Get all top-level directories (excluding hidden)
dirs=($(find "$TARGET_DIR" -maxdepth 1 -type d ! -name ".*" ! -path "$TARGET_DIR" | sort))

# Function to calculate Levenshtein distance
levenshtein() {
    local str1="$1"
    local str2="$2"
    local len1=${#str1}
    local len2=${#str2}

    # Simple similarity based on common prefix/suffix and length
    local max_len=$((len1 > len2 ? len1 : len2))
    local min_len=$((len1 < len2 ? len1 : len2))

    # Check for plural forms (e.g., test vs tests)
    if [[ "$str1" == "${str2}s" ]] || [[ "${str1}s" == "$str2" ]]; then
        echo "0.95"
        return
    fi

    # Check for common variations
    local base1=$(echo "$str1" | sed 's/s$//; s/es$//')
    local base2=$(echo "$str2" | sed 's/s$//; s/es$//')
    if [[ "$base1" == "$base2" ]]; then
        echo "0.90"
        return
    fi

    # Simple character overlap calculation
    local common=0
    for ((i=0; i<min_len; i++)); do
        if [[ "${str1:$i:1}" == "${str2:$i:1}" ]]; then
            ((common++))
        fi
    done

    echo "scale=2; $common / $max_len" | bc
}

# Function to compare directory structures
compare_structures() {
    local dir1="$1"
    local dir2="$2"

    local subdirs1=$(find "$dir1" -mindepth 1 -maxdepth 1 -type d -printf "%f\n" 2>/dev/null | sort)
    local subdirs2=$(find "$dir2" -mindepth 1 -maxdepth 1 -type d -printf "%f\n" 2>/dev/null | sort)

    local common_subdirs=$(comm -12 <(echo "$subdirs1") <(echo "$subdirs2") | wc -l)
    local total_subdirs=$(echo -e "$subdirs1\n$subdirs2" | sort -u | grep -v "^$" | wc -l)

    if [[ $total_subdirs -eq 0 ]]; then
        echo "0"
    else
        echo "scale=2; $common_subdirs / $total_subdirs" | bc
    fi
}

echo "=== Potential Duplicate/Similar Directories ==="
echo ""

found_issues=0

for ((i=0; i<${#dirs[@]}; i++)); do
    for ((j=i+1; j<${#dirs[@]}; j++)); do
        dir1="${dirs[$i]}"
        dir2="${dirs[$j]}"
        name1=$(basename "$dir1")
        name2=$(basename "$dir2")

        # Calculate name similarity
        name_sim=$(levenshtein "$name1" "$name2")

        # Calculate structure similarity
        struct_sim=$(compare_structures "$dir1" "$dir2")

        # Check if similar
        if (( $(echo "$name_sim >= $SIMILARITY_THRESHOLD" | bc -l) )) || \
           (( $(echo "$struct_sim >= $SIMILARITY_THRESHOLD" | bc -l) )); then
            found_issues=1
            echo "SIMILAR DIRECTORIES DETECTED:"
            echo "  Directory 1: $dir1"
            echo "  Directory 2: $dir2"
            echo "  Name Similarity: ${name_sim}"
            echo "  Structure Similarity: ${struct_sim}"
            echo ""
            echo "  Contents of $name1/:"
            ls -la "$dir1" 2>/dev/null | head -10 | sed 's/^/    /'
            echo ""
            echo "  Contents of $name2/:"
            ls -la "$dir2" 2>/dev/null | head -10 | sed 's/^/    /'
            echo ""
            echo "  Recommendation: Consider merging these directories"
            echo "  ----------------------------------------"
            echo ""
        fi
    done
done

if [[ $found_issues -eq 0 ]]; then
    echo "No similar or duplicate directories found."
fi

echo ""
echo "=== Scan Complete ==="
