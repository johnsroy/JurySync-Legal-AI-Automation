describe("Redline Feature", () => {
  before(() => {
    // Optionally, perform a login step if your app requires it:
    // cy.visit("/login");
    // cy.get("input[name=email]").type("test@example.com");
    // cy.get("input[name=password]").type("testpassword");
    // cy.get("button[type=submit]").click();
    // cy.url().should("include", "/dashboard");
  });

  it("allows users to compare two documents", () => {
    cy.visit("/redline"); // Ensure your dev server is running

    // Fill in "Original Text"
    cy.get("textarea").first().type("Hello");
    // Fill in "Proposed Text"
    cy.get("textarea").eq(1).type("Hello World");

    // Click the compare button
    cy.contains("Compare").click();

    // Wait for the diff result
    cy.contains("Comparison Results");
    cy.get("pre").should("contain.text", "Hello[+] World");
  });
}); 