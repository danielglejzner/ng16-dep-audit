# Want to upgrade to Angular 16? Use this dependency Upgrade Checker!

NGCC Has been removed in Angular 16.
Your ViewEngine dependencies need to be upgraded/removed/replaced in order for your project to work with Angular 16+

This library provides a simple CLI tool to check your Angular project's dependencies for compatibility with Angular 16. It identifies packages that may need upgrading or removal to ensure smooth operation with Angular 16 and its Ivy compilation and rendering pipeline.

## Features

- Checks each npm package in your project's `package.json`.
- Identifies Angular packages that need to be upgraded or removed/replaced to be compatible with Angular 16 compiler.
- Lists packages that do not have Angular dependencies or are not visible in the npm registry.

## Usage
- Make sure to run the command from a directory where you `package.json` is located

### Basic Command

```bash
npx ng16-dep-audit
```

### Command-Line Options

- **`--style=<style>`**: Specifies the output style. Available styles are `line` (default), `table`, and `markdown`.
- **`--output=<file>`**: Specifies the file to write the output to. If not provided, output will be displayed in the console.
- **`--skip-ng (-ng)`**: This will skip over all angular internal packages

### Examples

- Check dependencies and display results in a table format:

  ```bash
  npx ng16-dep-audit --style=table
  ```

- Check dependencies and save the results in markdown format to a file:

  ```bash
  npx ng16-dep-audit --output=dependency-report.md --style=markdown
  ```

For more information on usage and options, run `npx ng16-dep-audit --help`.
