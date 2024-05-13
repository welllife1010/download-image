const puppeteer = require("puppeteer-extra")
const StealthPlugin = require("puppeteer-extra-plugin-stealth")
const AnonymizeUAPlugin = require("puppeteer-extra-plugin-anonymize-ua")
const fs = require("fs")
const path = require("path")

// Add plugins
puppeteer.use(StealthPlugin())
puppeteer.use(AnonymizeUAPlugin())

async function downloadImagesFromJson(jsonFilePath, outputFolder) {
  const stateFilePath = path.join(outputFolder, "download_state.json")

  try {
    // Launch Puppeteer
    const browser = await puppeteer.launch({
      timeout: 60000, // Increase timeout to 60 seconds
    })
    const page = await browser.newPage()

    // Read JSON file
    const jsonData = require(jsonFilePath)

    // Create output folder if it doesn't exist
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(outputFolder, { recursive: true })
    }

    // Initialize state
    let lastProcessedIndex = 0

    // Function to save state to file
    const saveState = () => {
      const state = { lastProcessedIndex }
      fs.writeFileSync(stateFilePath, JSON.stringify(state))
    }

    // Check if a state file exists
    if (fs.existsSync(stateFilePath)) {
      const stateData = fs.readFileSync(stateFilePath)
      lastProcessedIndex = JSON.parse(stateData).lastProcessedIndex
    }

    // Loop through JSON data and download images
    for (let i = lastProcessedIndex; i < jsonData.length; i++) {
      const item = jsonData[i]

      // Check if item has ManufacturerProductNumber and PhotoUrl
      if (!item.ManufacturerProductNumber || !item.PhotoUrl) {
        console.log(`Skipping item: ${i} / ${jsonData.length}`, item)
        continue
      }

      const manufacturerProductNumber = item.ManufacturerProductNumber.replace(
        /\//g,
        "-"
      ) // Replace slashes with dashes
      const photoUrl = item.PhotoUrl

      const imageName = `${manufacturerProductNumber}.jpg` // Always save as .jpg
      const imagePath = path.join(outputFolder, imageName)

      try {
        await page.goto(photoUrl, {
          waitUntil: ["domcontentloaded", "networkidle0"],
        })

        // Extract image URL from the page
        const imageURL = await page.evaluate(
          () => document.querySelector("img").src
        )

        // Download the image
        const imageBuffer = await page.goto(imageURL)
        fs.writeFileSync(imagePath, await imageBuffer.buffer())

        // Log the progress with total count
        console.log(
          `Index ${i + 1} / ${jsonData.length}. Image downloaded: ${imageName}`
        )

        // Update last processed index
        lastProcessedIndex = i

        // Save state periodically
        if (i % 10 === 0) {
          saveState()
        }
      } catch (error) {
        console.error(`Error downloading image (${photoUrl}):`, error)
        continue // Skip to the next URL if an error occurs
      }
    }

    // Save state at the end
    saveState()

    // Close Puppeteer
    await browser.close()
    console.log("All images downloaded successfully.")
  } catch (error) {
    console.error("Error downloading images:", error)
  }
}

const jsonFilePath = "./reference-files/microcontroller-image-0502_4.json"
const outputFolder = "./generated-folders/microcontrollers_images"

downloadImagesFromJson(jsonFilePath, outputFolder)
