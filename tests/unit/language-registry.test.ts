#!/usr/bin/env node

/**
 * Language Registry Unit Tests
 * Tests language metadata retrieval and validation
 */

import {
  LANGUAGES,
  getLanguage,
  getLanguageById,
  getAllLanguages,
  isLanguageSupported,
} from "../../src/core/languages/languageRegistry.ts";

async function runTests() {
  console.log("🧪 Language Registry Unit Tests\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Test 1: Get all languages
    console.log("Test 1: Get all languages");
    const allLangs = getAllLanguages();

    if (Array.isArray(allLangs) && allLangs.length >= 2) {
      console.log(`✓ Retrieved ${allLangs.length} languages\n`);
      testsPassed++;
    } else {
      console.log("✗ Failed to retrieve languages\n");
      testsFailed++;
    }

    // Test 2: Get Python language
    console.log("Test 2: Get Python language");
    const python = getLanguage("python");

    if (
      python &&
      python.id === "python" &&
      python.version === "3.12" &&
      python.features.stdin === true
    ) {
      console.log("✓ Python language retrieved correctly\n");
      testsPassed++;
    } else {
      console.log("✗ Python language retrieval failed\n");
      testsFailed++;
    }

    // Test 3: Get C language
    console.log("Test 3: Get C language");
    const c = getLanguage("c");

    if (
      c &&
      c.id === "c" &&
      c.version === "GCC 13" &&
      Array.isArray(c.compiler_flags_allowed)
    ) {
      console.log("✓ C language retrieved correctly\n");
      testsPassed++;
    } else {
      console.log("✗ C language retrieval failed\n");
      testsFailed++;
    }

    // Test 4: Language alias support (py -> python)
    console.log("Test 4: Language alias support");
    const pythonAlias = getLanguageById("py");

    if (pythonAlias && pythonAlias.id === "python") {
      console.log("✓ Alias 'py' resolved to Python\n");
      testsPassed++;
    } else {
      console.log("✗ Alias resolution failed\n");
      testsFailed++;
    }

    // Test 5: Language alias support (gcc -> c)
    console.log("Test 5: GCC alias support");
    const cAlias = getLanguageById("gcc");

    if (cAlias && cAlias.id === "c") {
      console.log("✓ Alias 'gcc' resolved to C\n");
      testsPassed++;
    } else {
      console.log("✗ GCC alias resolution failed\n");
      testsFailed++;
    }

    // Test 6: Check language support
    console.log("Test 6: Check if Python is supported");
    const pythonSupported = isLanguageSupported("python");

    if (pythonSupported === true) {
      console.log("✓ Python correctly identified as supported\n");
      testsPassed++;
    } else {
      console.log("✗ Python support check failed\n");
      testsFailed++;
    }

    // Test 7: Unsupported language
    console.log("Test 7: Check unsupported language");
    const javaSupported = isLanguageSupported("java");

    if (javaSupported === false) {
      console.log("✓ Java correctly identified as unsupported\n");
      testsPassed++;
    } else {
      console.log("✗ Unsupported language check failed\n");
      testsFailed++;
    }

    // Test 8: Get unsupported language returns null
    console.log("Test 8: Get unsupported language");
    const java = getLanguage("java");

    if (java === null) {
      console.log("✓ Unsupported language returns null\n");
      testsPassed++;
    } else {
      console.log("✗ Should return null for unsupported language\n");
      testsFailed++;
    }

    // Test 9: Verify Python has required fields
    console.log("Test 9: Verify Python metadata completeness");
    const pythonComplete = getLanguage("python");
    const requiredFields = [
      "id",
      "name",
      "version",
      "description",
      "memory_limit_mb",
      "cpu_limit",
      "timeout_ms",
      "features",
      "example",
    ];

    const hasAllFields = requiredFields.every(
      (field) => pythonComplete[field] !== undefined
    );

    if (hasAllFields) {
      console.log("✓ Python has all required metadata fields\n");
      testsPassed++;
    } else {
      console.log("✗ Python missing required fields\n");
      testsFailed++;
    }

    // Test 10: Verify C has compiler flags
    console.log("Test 10: Verify C has compiler flags");
    const cComplete = getLanguage("c");

    if (
      cComplete.compiler_flags_default &&
      Array.isArray(cComplete.compiler_flags_allowed) &&
      cComplete.compiler_flags_allowed.length > 0
    ) {
      console.log("✓ C has compiler flags configured\n");
      testsPassed++;
    } else {
      console.log("✗ C missing compiler flags\n");
      testsFailed++;
    }

    // Test 11: Verify features object structure
    console.log("Test 11: Verify features object structure");
    const features = python.features;

    if (
      typeof features.stdin === "boolean" &&
      typeof features.file_io === "boolean" &&
      typeof features.networking === "boolean"
    ) {
      console.log("✓ Features object has correct structure\n");
      testsPassed++;
    } else {
      console.log("✗ Features object structure invalid\n");
      testsFailed++;
    }

    // Test 12: Verify all languages have unique IDs
    console.log("Test 12: Verify unique language IDs");
    const ids = allLangs.map((l) => l.id);
    const uniqueIds = new Set(ids);

    if (ids.length === uniqueIds.size) {
      console.log("✓ All language IDs are unique\n");
      testsPassed++;
    } else {
      console.log("✗ Duplicate language IDs found\n");
      testsFailed++;
    }

    // Summary
    console.log("\n" + "=".repeat(50));
    console.log(`Tests Passed: ${testsPassed}`);
    console.log(`Tests Failed: ${testsFailed}`);
    console.log("=".repeat(50));

    process.exit(testsFailed > 0 ? 1 : 0);
  } catch (err) {
    console.error("\n❌ Test suite error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

runTests();
