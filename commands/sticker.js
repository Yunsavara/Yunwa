const { Jimp } = require("jimp");
const { downloadContentFromMessage } = require("baileys");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");

const execAsync = promisify(exec);

// Constants
const STICKER_SIZE = 512;
const MAX_TEXT_LENGTH = 30;
const FONT_SIZE_BASE = 55;
const FONT_SIZE_MIN = 25;
const HORIZONTAL_PADDING = 80;
const CHAR_WIDTH_RATIO = 0.65;
const TEXT_MARGIN = 25;
const WATERMARK_PACK = "Yunwa WA Bot";
const WATERMARK_AUTHOR = "Yunsavara";

/**
 * Parse text options from command arguments
 * @param {Array<string>} args - Command arguments
 * @returns {{topText: string|null, bottomText: string|null}}
 */
function parseTextOptions(args) {
    if (!args || args.length === 0) {
        return { topText: null, bottomText: null };
    }

    const fullText = args.join(" ");
    const tIndex = fullText.indexOf("t:");
    const bIndex = fullText.indexOf("b:");

    let topText = null;
    let bottomText = null;

    if (tIndex !== -1) {
        const endIndex =
            bIndex !== -1 && bIndex > tIndex ? bIndex : fullText.length;
        topText = fullText.substring(tIndex + 2, endIndex).trim();
    }

    if (bIndex !== -1) {
        const endIndex =
            tIndex !== -1 && tIndex > bIndex ? tIndex : fullText.length;
        bottomText = fullText.substring(bIndex + 2, endIndex).trim();
    }

    return { topText, bottomText };
}

/**
 * Validate text length
 * @param {string|null} text - Text to validate
 * @param {number} maxLength - Maximum allowed length
 * @returns {{valid: boolean, error: string|null}}
 */
function validateTextLength(text, maxLength) {
    if (!text) return { valid: true, error: null };

    if (text.length > maxLength) {
        return {
            valid: false,
            error: `Text maximum ${maxLength} characters!`,
        };
    }

    return { valid: true, error: null };
}

/**
 * Extract image message from WhatsApp message
 * @param {Object} msg - WhatsApp message object
 * @returns {Object|null} Image message or null
 */
function extractImageMessage(msg) {
    const quotedMsg =
        msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quotedMsg?.imageMessage) {
        return quotedMsg.imageMessage;
    } else if (msg.message?.imageMessage) {
        return msg.message.imageMessage;
    }

    return null;
}

/**
 * Download image from WhatsApp message
 * @param {Object} imageMessage - WhatsApp image message
 * @returns {Promise<Buffer>} Image buffer
 */
async function downloadImage(imageMessage) {
    const stream = await downloadContentFromMessage(imageMessage, "image");

    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }

    if (!buffer || buffer.length === 0) {
        throw new Error("Failed to download image");
    }

    return buffer;
}

/**
 * Calculate crop position with top bias
 * @param {number} scaledHeight - Scaled image height
 * @param {number} targetSize - Target size
 * @param {number} scale - Scale factor
 * @returns {number} Crop Y position
 */
function calculateCropY(scaledHeight, targetSize, scale) {
    if (scaledHeight <= targetSize) {
        return 0;
    }

    if (scale > 1.5) {
        // Heavy zoom - very strong top bias
        return Math.floor((scaledHeight - targetSize) * 0.1);
    } else if (scale > 1.2) {
        // Medium zoom - strong top bias
        return Math.floor((scaledHeight - targetSize) * 0.2);
    } else {
        // Light zoom - moderate top bias
        return Math.floor((scaledHeight - targetSize) * 0.25);
    }
}

/**
 * Process and resize image to sticker size
 * @param {Buffer} buffer - Image buffer
 * @returns {Promise<{image: Jimp, pngBuffer: Buffer}>}
 */
async function processImage(buffer) {
    let image = await Jimp.read(buffer);

    const width = image.width;
    const height = image.height;

    // Calculate scale to cover entire area
    const scale = Math.max(STICKER_SIZE / width, STICKER_SIZE / height);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    // Resize with cover
    image = await image.resize({ w: scaledWidth, h: scaledHeight });

    // Calculate crop positions
    const cropX = Math.floor((scaledWidth - STICKER_SIZE) / 2);
    const cropY = calculateCropY(scaledHeight, STICKER_SIZE, scale);

    // Crop to target size
    image = await image.crop({
        x: cropX,
        y: cropY,
        w: STICKER_SIZE,
        h: STICKER_SIZE,
    });

    const pngBuffer = await image.getBuffer("image/png");
    return { image, pngBuffer };
}

/**
 * Calculate font size based on text length
 * @param {string} text - Text to render
 * @param {number} imageWidth - Image width
 * @returns {number} Font size
 */
function calculateFontSize(text, imageWidth) {
    const availableWidth = imageWidth - HORIZONTAL_PADDING;
    const estimatedTextWidth = text.length * FONT_SIZE_BASE * CHAR_WIDTH_RATIO;

    if (estimatedTextWidth > availableWidth) {
        const scaledSize = Math.floor(
            availableWidth / text.length / CHAR_WIDTH_RATIO,
        );
        return Math.max(scaledSize, FONT_SIZE_MIN);
    }

    return FONT_SIZE_BASE;
}

/**
 * Add text overlay to image using ImageMagick
 * @param {string} inputPath - Input PNG path
 * @param {string} outputPath - Output PNG path
 * @param {string|null} topText - Top text
 * @param {string|null} bottomText - Bottom text
 * @returns {Promise<boolean>} Success status
 */
async function addTextOverlay(inputPath, outputPath, topText, bottomText) {
    if (!topText && !bottomText) {
        return false;
    }

    const commands = [];

    if (topText) {
        const fontSize = calculateFontSize(topText, STICKER_SIZE);
        const escapedText = topText.replace(/'/g, "'\\''");
        commands.push(
            `-gravity North -pointsize ${fontSize} -fill white -stroke black -strokewidth 3 -font DejaVu-Sans-Bold -annotate +0+${TEXT_MARGIN} '${escapedText.toUpperCase()}'`,
        );
    }

    if (bottomText) {
        const fontSize = calculateFontSize(bottomText, STICKER_SIZE);
        const escapedText = bottomText.replace(/'/g, "'\\''");
        commands.push(
            `-gravity South -pointsize ${fontSize} -fill white -stroke black -strokewidth 3 -font DejaVu-Sans-Bold -annotate +0+${TEXT_MARGIN} '${escapedText.toUpperCase()}'`,
        );
    }

    const convertCmd = `magick "${inputPath}" ${commands.join(" ")} "${outputPath}"`;

    try {
        await execAsync(convertCmd);
        return true;
    } catch (error) {
        console.error("ImageMagick error:", error.message);
        return false;
    }
}

/**
 * Convert PNG to WebP with exif metadata
 * @param {string} pngPath - Input PNG path
 * @param {string} webpPath - Output WebP path
 * @returns {Promise<void>}
 */
async function convertToWebp(pngPath, webpPath) {
    // Create exif metadata with watermark
    const exifData = {
        "sticker-pack-id": "com.yunwa.wabot",
        "sticker-pack-name": WATERMARK_PACK,
        "sticker-pack-publisher": WATERMARK_AUTHOR,
    };

    const exifJson = JSON.stringify(exifData);
    const exifBase64 = Buffer.from(exifJson).toString("base64");

    // Convert to WebP
    await execAsync(`cwebp -q 100 -preset icon "${pngPath}" -o "${webpPath}"`);

    // Add exif metadata using webpmux
    try {
        // Create temp exif file
        const tmpDir = os.tmpdir();
        const exifPath = path.join(tmpDir, `exif_${Date.now()}.exif`);

        // Write exif data
        const exifBuffer = Buffer.from([
            0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41,
            0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
        ]);

        const jsonBuffer = Buffer.from(exifJson, "utf-8");
        const combinedBuffer = Buffer.concat([exifBuffer, jsonBuffer]);

        await fs.writeFile(exifPath, combinedBuffer);

        // Add exif to webp
        await execAsync(
            `webpmux -set exif "${exifPath}" "${webpPath}" -o "${webpPath}"`,
        );

        // Cleanup exif file
        await fs.unlink(exifPath);
    } catch (exifError) {
        console.error(
            "Warning: Could not add exif metadata:",
            exifError.message,
        );
        // Continue without exif - not critical
    }
}

/**
 * Generate temp file paths
 * @returns {{pngPath: string, textPath: string, webpPath: string}}
 */
function generateTempPaths() {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);

    return {
        pngPath: path.join(tmpDir, `sticker_${timestamp}_${randomId}.png`),
        textPath: path.join(
            tmpDir,
            `sticker_text_${timestamp}_${randomId}.png`,
        ),
        webpPath: path.join(tmpDir, `sticker_${timestamp}_${randomId}.webp`),
    };
}

/**
 * Cleanup temporary files
 * @param {string[]} paths - Paths to delete
 */
async function cleanupTempFiles(...paths) {
    for (const filePath of paths) {
        if (filePath) {
            try {
                await fs.unlink(filePath);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    }
}

/**
 * Send usage instructions
 * @param {Object} yunwa - Baileys client
 * @param {string} sender - Sender JID
 */
async function sendUsageInstructions(yunwa, sender) {
    await yunwa.sendMessage(sender, {
        text:
            "❌ *How to use:* Reply to a photo with !sticker [options]\n\n" +
            "*Examples:*\n" +
            "• !sticker\n" +
            "• !sticker t:Hello World\n" +
            "• !sticker b:Bottom Text\n" +
            "• !sticker t:Top Text b:Bottom Text\n\n" +
            `⚠️ Maximum ${MAX_TEXT_LENGTH} characters per text`,
    });
}

/**
 * Sticker command - Convert image to WhatsApp sticker with optional text
 * Usage: !sticker [t:text] [b:text]
 */
module.exports = {
    name: "sticker",
    description: "Convert image to sticker with optional text overlay",
    category: "media",
    async execute(yunwa, msg, sender, pushname, args = []) {
        let tempPngPath = null;
        let tempTextPath = null;
        let tempWebpPath = null;

        try {
            await yunwa.sendPresenceUpdate("composing", sender);

            // Extract image message
            const imageMessage = extractImageMessage(msg);
            if (!imageMessage) {
                await sendUsageInstructions(yunwa, sender);
                return;
            }

            // Parse and validate text options
            const { topText, bottomText } = parseTextOptions(args);

            const topValidation = validateTextLength(topText, MAX_TEXT_LENGTH);
            if (!topValidation.valid) {
                await yunwa.sendMessage(sender, {
                    text: `❌ Top ${topValidation.error}`,
                });
                return;
            }

            const bottomValidation = validateTextLength(
                bottomText,
                MAX_TEXT_LENGTH,
            );
            if (!bottomValidation.valid) {
                await yunwa.sendMessage(sender, {
                    text: `❌ Bottom ${bottomValidation.error}`,
                });
                return;
            }

            // Download image
            const imageBuffer = await downloadImage(imageMessage);

            // Process image
            const { pngBuffer } = await processImage(imageBuffer);

            // Generate temp paths
            const tempPaths = generateTempPaths();
            tempPngPath = tempPaths.pngPath;
            tempTextPath = tempPaths.textPath;
            tempWebpPath = tempPaths.webpPath;

            // Save initial PNG
            await fs.writeFile(tempPngPath, pngBuffer);

            // Add text overlay if provided
            const textAdded = await addTextOverlay(
                tempPngPath,
                tempTextPath,
                topText,
                bottomText,
            );

            // Use text version if text was added successfully
            const finalPngPath = textAdded ? tempTextPath : tempPngPath;

            // Convert to WebP with watermark metadata
            await convertToWebp(finalPngPath, tempWebpPath);

            // Read and send sticker
            const stickerBuffer = await fs.readFile(tempWebpPath);
            await yunwa.sendMessage(sender, {
                sticker: stickerBuffer,
            });

            await yunwa.sendPresenceUpdate("paused", sender);
        } catch (error) {
            console.error("Error in sticker command:", error);
            console.error("Stack:", error.stack);

            let errorMsg = `❌ Error: ${error.message}\n\n💡 Make sure to reply to a photo!`;

            if (error.message.includes("cwebp")) {
                errorMsg =
                    "❌ cwebp is not installed!\n\nInstall: pkg install libwebp";
            } else if (error.message.includes("magick")) {
                errorMsg =
                    "❌ ImageMagick is not installed!\n\nInstall: pkg install imagemagick";
            } else if (error.message.includes("webpmux")) {
                errorMsg =
                    "⚠️ Warning: webpmux not found. Sticker created without watermark metadata.\n\nInstall: pkg install libwebp";
            }

            await yunwa.sendMessage(sender, { text: errorMsg });
            await yunwa.sendPresenceUpdate("paused", sender);
        } finally {
            // Cleanup temp files
            await cleanupTempFiles(tempPngPath, tempTextPath, tempWebpPath);
        }
    },
};
