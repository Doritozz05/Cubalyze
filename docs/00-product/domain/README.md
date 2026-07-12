# CubeForge Domain Knowledge

## Purpose

The `domain/` directory is the single source of truth for the business rules, mathematics, and real-world mechanics of speedcubing. **Domain Knowledge is not Software Architecture.**

Before designing state managers, rendering pipelines, or database schemas, the engineering team and AI agents must understand *what* they are modeling.

## What Belongs Here

This directory will scale to contain:

- **WCA Rules & Regulations**: Formal inspection constraints, +2 penalties, DNF conditions.
- **Cube Mathematics**: Group theory, permutations, parity conditions.
- **Cube Representation**: Concept of Bitboards vs. Arrays vs. Matrices.
- **Notation Standard**: Standardized move strings (e.g., `R U R' U'`).
- **Smart Cube Ecosystem**: Proprietary protocols (GAN, MoYu, GoCube).
- **Solving Methods**: CFOP, Roux, ZZ, and phase detection logic.
- **Algorithms**: OLL, PLL, ZBLL datasets.
- **Statistics**: Ao5, Ao12, Ao100 calculations, standard deviations.

## What Does NOT Belong Here

- How to store the cube in SQLite (Goes to `02-architecture/overview/` or `05-tdd/`).
- How to render the cube with WebGL (Goes to `02-architecture/overview/`).
- User interface designs for the timer (Goes to `00-product/`).

## Glossary

A master glossary of all speedcubing terms will be maintained here to ensure consistent variables and naming conventions across the entire codebase.
