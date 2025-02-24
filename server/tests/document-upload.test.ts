import request from "supertest";
import { app } from "../app";
import { readFileSync } from "fs";
import path from "path";

describe("Document Upload Tests", () => {
  const testFiles = {
    pdf: path.join(__dirname, "fixtures/test.pdf"),
    docx: path.join(__dirname, "fixtures/test.docx"),
    doc: path.join(__dirname, "fixtures/test.doc"),
    txt: path.join(__dirname, "fixtures/test.txt"),
  };

  test.each(Object.entries(testFiles))(
    "should process %s file correctly",
    async (type, filePath) => {
      const response = await request(app)
        .post("/api/contract-automation/process")
        .attach("file", readFileSync(filePath), path.basename(filePath));

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("documentId");
      expect(response.body).toHaveProperty("content");
      expect(response.body).toHaveProperty("metadata");
    },
  );

  test("should handle invalid file type", async () => {
    const response = await request(app)
      .post("/api/contract-automation/process")
      .attach("file", Buffer.from("test"), "test.invalid");

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("success", false);
    expect(response.body).toHaveProperty("error");
  });

  test("should handle missing file", async () => {
    const response = await request(app)
      .post("/api/contract-automation/process")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("success", false);
    expect(response.body).toHaveProperty("error", "No file uploaded");
  });
});
