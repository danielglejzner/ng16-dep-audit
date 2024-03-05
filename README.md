# Angular 16 Dependency Upgrade Checker

NGCC Has been removed in Angular 16.
Your ViewEngine dependencies need to be upgraded/removed/replaced in order for your project to work with Angular 16+

This library provides a simple CLI tool to check your Angular project's dependencies for compatibility with Angular 16. It identifies packages that may need upgrading or removal to ensure smooth operation with Angular 16 and its Ivy compilation and rendering pipeline.

## Features

- Checks each npm package in your project's `package.json`.
- Identifies Angular packages that need to be upgraded/removed/replaced to be compatible with Angular 16 compiler.
- Lists packages that do not have Angular dependencies or are not visible in the npm registry.
