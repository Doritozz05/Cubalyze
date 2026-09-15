# Diagram Standards

**Owner**: Principal Architect
**Lifecycle**: Living Document
**Document Type**: Standard

## Purpose

To establish a consistent, maintainable approach to visual documentation within Cubalyze.

## Allowed Diagram Types and Tools

Visual documentation must be stored as plain text whenever possible to allow version control and AI consumption.

1. **Mermaid (`.mmd` or embedded in markdown)**: The primary tool for all diagrams.
2. **C4 Model**: Used for system context, containers, and components. Must be implemented via Mermaid C4 syntax or PlantUML.

## When to use which diagram

### 1. Architecture / System Context
*   **Tool**: C4 Model (Context & Container diagrams).
*   **Use Case**: Documenting how Cubalyze interacts with external systems (WCA API, Bluetooth cubes) or how its high-level internal containers interact.

### 2. Sequence Diagrams
*   **Tool**: Mermaid Sequence Diagram.
*   **Use Case**: Documenting time-based interactions. Examples: The OAuth login flow, the Bluetooth connection handshake, event propagation from UI to hardware layer.

### 3. State Machines
*   **Tool**: Mermaid State Diagram.
*   **Use Case**: Documenting complex state logic. Examples: Timer states (Idle -> Inspecting -> Solving -> Finished), Bluetooth connection states (Disconnected -> Scanning -> Connecting -> Connected).

### 4. ER Diagrams (Entity-Relationship)
*   **Tool**: Mermaid ER Diagram.
*   **Use Case**: Database schemas (`07-database/`). Documenting how `Solves`, `Sessions`, and `Users` relate to each other.

### 5. Flowcharts
*   **Tool**: Mermaid Flowchart.
*   **Use Case**: Decision trees, business logic flows. Example: Algorithm for determining a +2 penalty.

### 6. Class Diagrams
*   **Tool**: Mermaid Class Diagram.
*   **Use Case**: Documenting object-oriented structures, interfaces, and inheritance. Should be used sparingly, mostly for complex core logic, as TDDs usually cover this.

## Best Practices

1. **Embed or Link**: Small diagrams should be embedded directly in markdown using ```mermaid. Large or shared diagrams should be standalone `.mmd` files referenced by documents.
2. **Keep it focused**: A diagram should explain one thing well. If it is too large, break it down.
3. **Always provide text fallback**: AI agents cannot always parse the visual intent of a complex diagram, but they can read Mermaid syntax. Always explain the core takeaway of the diagram in the surrounding text.
