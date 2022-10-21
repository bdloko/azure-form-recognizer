const http = require("http");
const express = require("express");
const bodyParser = require("body-parser");
const AzureStorageBlob = require("@azure/storage-blob");
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
var cors = require("cors");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const {
  DocumentAnalysisClient,
  AzureKeyCredential,
} = require("@azure/ai-form-recognizer");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const hostname = "127.0.0.1";

const port = process.env.PORT || "3002";
app.set("port", port);

const server = http.createServer(app);
server.listen(port);

// enable files upload
app.use(
  fileUpload({
    createParentPath: true,
  })
);

app.use((req, res, next) => {
  console.log("Enter CORS");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS, PUT"
  );
  next();
});

app.options("*", cors()); // include before other routes

app.use("/api/analyze", (req, res, next) => {
  if (!req.files) {
    return res.status(400).send("No files were uploaded.");
  }
  let file = req.files.file;
  uploadPath = new Date().getTime() + ".jpg";
  file.mv(uploadPath, async () => {
    recognizeForm(uploadPath).then((result) => {
      return res.status(200).json({
        output: result,
      });
      console.log(result, "file results!");
    });
    blobStorage(uploadPath);
  });
});

async function blobStorage(file) {
  const storageAccount ="";
  const containerName = "";
  const storageAPIKey = ""

  const sharedKeyCredential = new StorageSharedKeyCredential(storageAccount, storageAPIKey);
  const blobServiceClient = new BlobServiceClient(
    `https://${storageAccount}.blob.core.windows.net`,
    sharedKeyCredential
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(file);
  const uploadBlobResponse = await blockBlobClient.uploadData(fs.readFileSync(file));
  console.log(`Upload block blob ${file} successfully`, uploadBlobResponse.requestId);
}

async function recognizeForm(file) {
  const endpoint = "";
  const apiKey = "";
  // const modelId = "24055ea7-35e6-4bb4-b24e-af767aada9fd";
  console.log("Entering Forms Recognizer");

  let fileStream = fs.createReadStream(file);
  
  const client = new DocumentAnalysisClient(
    endpoint,
    new AzureKeyCredential(apiKey)
  );

  

  const poller = await client.beginAnalyzeDocument("prebuilt-layout", fileStream, {
    contentType: "image/jpeg",      
    onProgress: (state) => {
      console.log(`status: ${state.status}`);
    },
  });
  
  const {
    pages,
    tables
  } = await poller.pollUntilDone();

  if (pages.length <= 0) {
      console.log("No pages were extracted from the document.");
  } else {
      console.log("Pages:");
      for (const page of pages) {
          console.log("- Page", page.pageNumber, `(unit: ${page.unit})`);
          console.log(`  ${page.width}x${page.height}, angle: ${page.angle}`);
          console.log(`  ${page.lines.length} lines, ${page.words.length} words`);
      }
  }

  if (tables.length <= 0) {
      console.log("No tables were extracted from the document.");
  } else {
      console.log("Tables:");
      for (const table of tables) {
          console.log(
              `- Extracted table: ${table.columnCount} columns, ${table.rowCount} rows (${table.cells.length} cells)`
          );
      }
  }

  fs.unlinkSync(uploadPath);
  return tables;
}
