const { Jimp } = require("jimp");
const { downloadContentFromMessage } = require("baileys");
const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const { Image } = require("node-webpmux");

const execAsync = promisify(exec);

// Constants
const STICKER_SIZE = 512;
const MAX_TEXT_LENGTH = 30;
const STICKER_METADATA = {
    "sticker-pack-id": "yunwa.bot.stickers",
    "sticker-pack-name": "Yunwa WA Bot",
    "sticker-pack-publisher": "Yunwa WA Bot",
};

/**
 * Extract image message from the msg object
 * @param {Object} msg - WhatsApp message object
 * @returns {Object|null} - Image message or null
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
 * Parse text arguments for top and bottom text
 * @param {Array} args - Command arguments
 * @returns {Object} - { topText, bottomText, error }
 */
function parseTextArguments(args) {
    let topText = null;
    let bottomText = null;

    if (!args || args.length === 0) {
        return { topText, bottomText, error: null };
    }

    // Join all args back into a string
    const fullText = args.join(" ");

    // Find t: and b: positions
    const tIndex = fullText.indexOf("t:");
    const bIndex = fullText.indexOf("b:");

    if (tIndex !== -1) {
        // Extract top text
        let endIndex =
            bIndex !== -1 && bIndex > tIndex ? bIndex : fullText.length;
        topText = fullText.substring(tIndex + 2, endIndex).trim();

        if (topText.length > MAX_TEXT_LENGTH) {
            return {
                topText: null,
                bottomText: null,
                error: `❌ Top text maximum ${MAX_TEXT_LENGTH} characters!`,
            };
        }
    }

    if (bIndex !== -1) {
        // Extract bottom text
        let endIndex =
            tIndex !== -1 && tIndex > bIndex ? tIndex : fullText.length;
        bottomText = fullText.substring(bIndex + 2, endIndex).trim();

        if (bottomText.length > MAX_TEXT_LENGTH) {
            return {
                topText: null,
                bottomText: null,
                error: `❌ Bottom text maximum ${MAX_TEXT_LENGTH} characters!`,
            };
        }
    }

    return { topText, bottomText, error: null };
}

/**
 * Download image from WhatsApp message
 * @param {Object} imageMessage - Image message object
 * @returns {Buffer} - Image buffer
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
 * Calculate crop position with top bias for better subject framing
 * @param {number} scaledHeight - Scaled image height
 * @param {number} targetSize - Target sticker size
 * @param {number} scale - Scale factor used
 * @returns {number} - Crop Y position
 */
function calculateCropY(scaledHeight, targetSize, scale) {
    if (scaledHeight <= targetSize) {
        return 0;
    }

    // Lower cropY = more top bias (captures faces/subjects better)
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
 * Process image: resize and crop to sticker size
 * @param {Buffer} imageBuffer - Input image buffer
 * @returns {Object} - Processed Jimp image
 */
async function processImage(imageBuffer) {
    let image = await Jimp.read(imageBuffer);

    const width = image.width;
    const height = image.height;

    // Calculate scale to cover entire 512x512 area
    const scale = Math.max(STICKER_SIZE / width, STICKER_SIZE / height);
    const scaledWidth = Math.round(width * scale);
    const scaledHeight = Math.round(height * scale);

    // Resize with cover strategy
    image = await image.resize({ w: scaledWidth, h: scaledHeight });

    // Calculate crop positions
    const cropX = Math.floor((scaledWidth - STICKER_SIZE) / 2);
    const cropY = calculateCropY(scaledHeight, STICKER_SIZE, scale);

    // Crop to 512x512
    image = await image.crop({
        x: cropX,
        y: cropY,
        w: STICKER_SIZE,
        h: STICKER_SIZE,
    });

    return image;
}

/**
 * Generate temporary file paths
 * @returns {Object} - { tempPngPath, tempTextPath, tempWebpPath }
 */
function generateTempPaths() {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);

    return {
        tempPngPath: path.join(tmpDir, `sticker_${timestamp}_${randomId}.png`),
        tempTextPath: path.join(
            tmpDir,
            `sticker_text_${timestamp}_${randomId}.png`,
        ),
        tempWebpPath: path.join(
            tmpDir,
            `sticker_${timestamp}_${randomId}.webp`,
        ),
    };
}

/**
 * Calculate font size based on text length
 * @param {string} text - Text to calculate for
 * @param {number} imageWidth - Image width
 * @returns {number} - Calculated font size
 */
function calculateFontSize(text, imageWidth) {
    const baseFontSize = 55;
    const minFontSize = 25;
    const horizontalPadding = 80;
    const charWidthRatio = 0.65;

    const availableWidth = imageWidth - horizontalPadding;
    const estimatedTextWidth = text.length * baseFontSize * charWidthRatio;

    if (estimatedTextWidth > availableWidth) {
        const scaledSize = Math.floor(
            availableWidth / text.length / charWidthRatio,
        );
        return Math.max(scaledSize, minFontSize);
    }

    return baseFontSize;
}

/**
 * Add text overlay to image using ImageMagick
 * @param {string} inputPath - Input PNG path
 * @param {string} outputPath - Output PNG path
 * @param {string} topText - Top text (optional)
 * @param {string} bottomText - Bottom text (optional)
 * @returns {string} - Path to final image (with or without text)
 */
async function addTextOverlay(inputPath, outputPath, topText, bottomText) {
    if (!topText && !bottomText) {
        return inputPath;
    }

    const commands = [];

    if (topText) {
        const fontSize = calculateFontSize(topText, STICKER_SIZE);
        const escapedText = topText.replace(/'/g, "'\\''");
        commands.push(
            `-gravity North -pointsize ${fontSize} -fill white -stroke black -strokewidth 3 -font DejaVu-Sans-Bold -annotate +0+25 '${escapedText.toUpperCase()}'`,
        );
    }

    if (bottomText) {
        const fontSize = calculateFontSize(bottomText, STICKER_SIZE);
        const escapedText = bottomText.replace(/'/g, "'\\''");
        commands.push(
            `-gravity South -pointsize ${fontSize} -fill white -stroke black -strokewidth 3 -font DejaVu-Sans-Bold -annotate +0+25 '${escapedText.toUpperCase()}'`,
        );
    }

    const convertCmd = `magick "${inputPath}" ${commands.join(" ")} "${outputPath}"`;

    try {
        await execAsync(convertCmd);
        return outputPath;
    } catch (error) {
        console.error("ImageMagick error:", error.message);
        // Fall back to image without text
        return inputPath;
    }
}

/**
 * Convert PNG to WebP using cwebp
 * @param {string} inputPath - Input PNG path
 * @param {string} outputPath - Output WebP path
 */
async function convertToWebp(inputPath, outputPath) {
    await execAsync(
        `cwebp -q 100 -preset icon "${inputPath}" -o "${outputPath}"`,
    );
}

/**
 * Add EXIF metadata to WebP sticker
 * @param {Buffer} webpBuffer - WebP image buffer
 * @returns {Buffer} - WebP with EXIF metadata
 */
async function addStickerMetadata(webpBuffer) {
    const img = new Image();
    await img.load(webpBuffer);

    img.exif = Buffer.from(JSON.stringify(STICKER_METADATA), "utf-8");

    return await img.save(null);
}

/**
 * Cleanup temporary files
 * @param {string} tempPngPath - PNG temp path
 * @param {string} tempTextPath - Text PNG temp path
 * @param {string} tempWebpPath - WebP temp path
 */
async function cleanupTempFiles(tempPngPath, tempTextPath, tempWebpPath) {
    try {
        if (tempPngPath && tempPngPath !== tempTextPath) {
            await fs.unlink(tempPngPath);
        }
        if (tempTextPath) await fs.unlink(tempTextPath);
        if (tempWebpPath) await fs.unlink(tempWebpPath);
    } catch (e) {
        // Ignore cleanup errors
    }
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
                return;
            }

            // Parse text arguments
            const { topText, bottomText, error } = parseTextArguments(args);

            if (error) {
                await yunwa.sendMessage(sender, { text: error });
                return;
            }

            // Download image
            const imageBuffer = await downloadImage(imageMessage);

            // Process image
            const processedImage = await processImage(imageBuffer);

            // Generate temp file paths
            const tempPaths = generateTempPaths();
            tempPngPath = tempPaths.tempPngPath;
            tempTextPath = tempPaths.tempTextPath;
            tempWebpPath = tempPaths.tempWebpPath;

            // Save PNG to temp file
            const pngBuffer = await processedImage.getBuffer("image/png");
            await fs.writeFile(tempPngPath, pngBuffer);

            // Add text overlay if needed
            const finalPngPath = await addTextOverlay(
                tempPngPath,
                tempTextPath,
                topText,
                bottomText,
            );

            // Convert to WebP
            await convertToWebp(finalPngPath, tempWebpPath);

            // Read WebP and add metadata
            const stickerBuffer = await fs.readFile(tempWebpPath);
            const stickerWithExif = await addStickerMetadata(stickerBuffer);

            // Send sticker
            await yunwa.sendMessage(sender, {
                sticker: stickerWithExif,
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
            }

            await yunwa.sendMessage(sender, { text: errorMsg });
            await yunwa.sendPresenceUpdate("paused", sender);
        } finally {
            // Cleanup temp files
            await cleanupTempFiles(tempPngPath, tempTextPath, tempWebpPath);
        }
    },
};
