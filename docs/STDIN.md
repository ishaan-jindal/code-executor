# stdin Examples

Comprehensive examples showing how to use stdin with the Code Executor API.

## Overview

The Code Executor supports passing standard input (stdin) to programs. This is useful for:
- Interactive programs that read user input
- Data processing pipelines
- Testing with predefined input
- Simulating user interaction

## Basic Syntax

All requests use the `/submit` endpoint with three parameters:

```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python|c",
    "code": "...source code...",
    "stdin": "...input data..."
  }'
```

---

## Python Examples

### Example 1: Simple Input

**Task:** Read a name and greet the user

**Code:**
```python
name = input("Enter your name: ")
print(f"Hello, {name}!")
```

**stdin:** `Alice`

**Output:**
```
Hello, Alice!
```

**curl command:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "name = input(\"Enter your name: \")\nprint(f\"Hello, {name}!\")",
    "stdin": "Alice"
  }'
```

---

### Example 2: Multiple Inputs

**Task:** Read numbers and calculate average

**Code:**
```python
n = int(input("How many numbers? "))
numbers = []
for i in range(n):
    numbers.append(int(input(f"Enter number {i+1}: ")))
avg = sum(numbers) / len(numbers)
print(f"Average: {avg:.2f}")
```

**stdin:**
```
3
10
20
30
```

**Output:**
```
Average: 20.00
```

**curl command:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "n = int(input(\"How many numbers? \"))\nnumbers = []\nfor i in range(n):\n    numbers.append(int(input(f\"Enter number {i+1}: \")))\navg = sum(numbers) / len(numbers)\nprint(f\"Average: {avg:.2f}\")",
    "stdin": "3\n10\n20\n30"
  }'
```

---

### Example 3: Line-by-Line Processing

**Task:** Read lines and reverse them

**Code:**
```python
lines = []
for _ in range(3):
    lines.append(input())
for line in reversed(lines):
    print(line)
```

**stdin:**
```
first
second
third
```

**Output:**
```
third
second
first
```

---

### Example 4: CSV Processing

**Task:** Read CSV data and calculate statistics

**Code:**
```python
data = []
for line in input().split(','):
    data.append(int(line))
print(f"Count: {len(data)}")
print(f"Min: {min(data)}")
print(f"Max: {max(data)}")
print(f"Sum: {sum(data)}")
```

**stdin:** `5,10,15,20,25`

**Output:**
```
Count: 5
Min: 5
Max: 25
Sum: 75
```

---

### Example 5: Conditional Input Processing

**Task:** Process input based on conditions

**Code:**
```python
x = int(input("Enter a number: "))
if x > 0:
    print("Positive")
elif x < 0:
    print("Negative")
else:
    print("Zero")
```

**stdin:** `-5`

**Output:**
```
Negative
```

---

## C Examples

### Example 6: Basic scanf

**Task:** Read and square a number

**Code:**
```c
#include <stdio.h>
int main() {
    int x;
    scanf("%d", &x);
    printf("Square of %d is %d\n", x, x * x);
    return 0;
}
```

**stdin:** `5`

**Output:**
```
Square of 5 is 25
```

**curl command:**
```bash
curl -X POST http://localhost:4000/submit \
  -H "Content-Type: application/json" \
  -d '{
    "language": "c",
    "code": "#include <stdio.h>\nint main() {\n    int x;\n    scanf(\"%d\", &x);\n    printf(\"Square of %d is %d\\\\n\", x, x * x);\n    return 0;\n}",
    "stdin": "5"
  }'
```

---

### Example 7: Multiple Inputs in C

**Task:** Read two numbers and perform operations

**Code:**
```c
#include <stdio.h>
int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("Sum: %d\n", a + b);
    printf("Difference: %d\n", a - b);
    printf("Product: %d\n", a * b);
    return 0;
}
```

**stdin:** `10 3`

**Output:**
```
Sum: 13
Difference: 7
Product: 30
```

---

### Example 8: String Input in C

**Task:** Read name and display multiple times

**Code:**
```c
#include <stdio.h>
int main() {
    char name[50];
    scanf("%s", name);
    for (int i = 0; i < 3; i++) {
        printf("%d: %s\n", i + 1, name);
    }
    return 0;
}
```

**stdin:** `Alice`

**Output:**
```
1: Alice
2: Alice
3: Alice
```

---

### Example 9: Array Input in C

**Task:** Read array and calculate sum

**Code:**
```c
#include <stdio.h>
int main() {
    int n;
    scanf("%d", &n);
    int arr[n];
    for (int i = 0; i < n; i++) {
        scanf("%d", &arr[i]);
    }
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    printf("Sum: %d\n", sum);
    return 0;
}
```

**stdin:**
```
4
10
20
30
40
```

**Output:**
```
Sum: 100
```

---

### Example 10: Line-by-Line String Input in C

**Task:** Read lines and print line numbers

**Code:**
```c
#include <stdio.h>
int main() {
    char line[100];
    int count = 0;
    while (fgets(line, sizeof(line), stdin) != NULL) {
        printf("%d: %s", ++count, line);
    }
    return 0;
}
```

**stdin:**
```
hello
world
test
```

**Output:**
```
1: hello
2: world
3: test
```

---

## Advanced Patterns

### Pattern 1: Simulate Interactive Session

**Python:**
```python
# Simulate a quiz
questions = [
    ("2 + 2 = ?", "4"),
    ("3 + 3 = ?", "6"),
]
score = 0
for q, answer in questions:
    user_ans = input(q + " ")
    if user_ans == answer:
        print("Correct!")
        score += 1
    else:
        print("Wrong!")
print(f"Score: {score}/{len(questions)}")
```

**stdin:**
```
4
6
```

---

### Pattern 2: Pipeline Processing

**Python:**
```python
# Read data, process, output results
import json
data = json.loads(input())
data['processed'] = True
data['count'] = len(str(data))
print(json.dumps(data))
```

**stdin:** `{"name": "test", "value": 42}`

---

### Pattern 3: Error Handling with Input

**Python:**
```python
try:
    x = int(input("Enter number: "))
    result = 100 / x
    print(f"Result: {result}")
except ZeroDivisionError:
    print("Cannot divide by zero!")
except ValueError:
    print("Invalid input!")
```

**stdin:** `0`

**Output:**
```
Cannot divide by zero!
```

---

## Tips and Best Practices

1. **Format stdin properly**: Use `\n` for line breaks in JSON strings
   ```json
   {
     "stdin": "line1\nline2\nline3"
   }
   ```

2. **Escape special characters**: In JSON, escape backslashes and quotes
   ```json
   {
     "code": "print(\"Hello\\nWorld\")"
   }
   ```

3. **Test locally first**: Test your code locally before submitting
   ```bash
   # Test locally
   echo "input" | python3 script.py
   
   # Then submit to API
   curl -X POST http://localhost:4000/submit ...
   ```

4. **Handle EOF**: Programs should handle end-of-input gracefully
   ```python
   try:
       while True:
           line = input()
           print(f"Read: {line}")
   except EOFError:
       print("Done")
   ```

5. **Avoid infinite loops**: Set reasonable timeouts (default: 2 seconds)
   ```python
   # This will timeout
   while True:
       pass
   ```

6. **Use appropriate data types**: Ensure input matches expected types
   ```python
   # Will fail if stdin is "abc"
   x = int(input())
   ```

---

## Common Issues

### Issue 1: "stdin: command not found"
**Cause:** The program is trying to execute `stdin` instead of using it  
**Solution:** Ensure you're using input functions: `input()` in Python, `scanf()` in C

### Issue 2: Program hangs or times out
**Cause:** Program expects more input than provided  
**Solution:** Provide complete stdin data

### Issue 3: Output doesn't include stdin echoing
**Cause:** Shells echo stdin by default, but Docker doesn't  
**Solution:** If you need to see input, explicitly print it:
```python
line = input()
print(f"You entered: {line}")  # Now you see it
```

### Issue 4: Special characters cause issues
**Cause:** JSON encoding/escaping problems  
**Solution:** Use `\n` for newlines, `\\` for backslashes, `\"` for quotes

---

## Testing

Run the integration tests to see stdin in action:

```bash
npm run test
```

This runs tests 11-13 which demonstrate stdin with Python and C.

---

## API Reference

For complete API documentation, see [docs/API.md](API.md)

---

**Last Updated:** January 31, 2026
