describe("Redline Feature", () => {
  beforeEach(() => {
    cy.visit("/redline");
  });

  it("allows users to compare two documents", () => {
    // Fill in "Original Text"
    cy.get("textarea").first().type("This is a sample contract agreement between Party A and Party B.");
    // Fill in "Proposed Text"
    cy.get("textarea").eq(1).type("This is a revised contract agreement between Party A and Party C.");

    // Click compare
    cy.contains("Compare").click();

    // Check for diff
    cy.contains("Comparison Results").should("be.visible");
    cy.get("[data-testid='diff-view']").should("exist");
    cy.get("[data-testid='diff-deletions']").should("contain", "Party B");
    cy.get("[data-testid='diff-additions']").should("contain", "Party C");
  });

  it("handles empty text fields", () => {
    cy.contains("Compare").click();
    cy.get("[data-testid='error-message']")
      .should("be.visible")
      .and("contain", "Please enter both original and proposed text");
  });

  it("allows clearing the comparison", () => {
    // Fill in some text
    cy.get("textarea").first().type("Original text");
    cy.get("textarea").eq(1).type("Modified text");

    // Compare
    cy.contains("Compare").click();

    // Clear
    cy.contains("Clear").click();

    // Verify fields are cleared
    cy.get("textarea").first().should("have.value", "");
    cy.get("textarea").eq(1).should("have.value", "");
    cy.get("[data-testid='diff-view']").should("not.exist");
  });

  it("supports file upload for comparison", () => {
    // Test file upload functionality
    cy.get("input[type=file]").first().selectFile("cypress/fixtures/original.txt", { force: true });
    cy.get("input[type=file]").eq(1).selectFile("cypress/fixtures/modified.txt", { force: true });

    cy.contains("Compare").click();

    cy.get("[data-testid='diff-view']").should("exist");
    cy.get("[data-testid='upload-success']").should("be.visible");
  });
});