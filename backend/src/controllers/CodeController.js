import { GoogleGenerativeAI } from '@google/generative-ai';
import CodeSnippet from '../models/CodeSnippet.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const textModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const PARAGRAPH_BREAK_TOKEN = "__PARAGRAPH_BREAK__";

function stripMarkdown(markdownString, type = 'paragraph') {
  if (!markdownString) return '';
  let plainText = markdownString;

  if (type === 'code') {
    const codeBlockMatch = plainText.match(/```(?:\w+\n)?([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      plainText = codeBlockMatch[1].trim();
    } else {
      plainText = plainText.trim();
    }
    return plainText;
  }

  plainText = plainText.replace(/```(?:\w+\n)?[\s\S]*?```/g, '');
  plainText = plainText.replace(/`([^`]+)`/g, '$1');
  plainText = plainText.replace(/(\*\*|__|\*|_)(.*?)\1/g, '$2');
  plainText = plainText.replace(/^#+\s*(.*)$/gm, '$1');
  plainText = plainText.replace(/^>\s*(.*)$/gm, '$1');
  plainText = plainText.replace(/^\s*[-*+]\s+/gm, '');
  plainText = plainText.replace(/^\s*\d+\.\s+/gm, '');
  plainText = plainText.replace(/(\r\n|\r|\n){2,}/g, PARAGRAPH_BREAK_TOKEN);
  plainText = plainText.replace(/(\r\n|\r|\n)/g, ' ');
  plainText = plainText.replace(/\s*__PARAGRAPH_BREAK__\s*/g, PARAGRAPH_BREAK_TOKEN);
  return plainText.trim();
}

function extractAndParseJson(rawString) {
  try {
    const jsonMatch = rawString.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    return JSON.parse(rawString);
  } catch (e) {
    console.error("Failed to parse JSON from AI response:", e);
    return null;
  }
}

const generateGeminiTextContent = async (prompt) => {
  try {
    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error calling Gemini Text API:", error);
    throw new Error("Failed to get response from AI model.");
  }
};

import Replicate from "replicate";
import fetch from "node-fetch"; // Important for ESM

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export const generateImageContent = async (imagePrompt) => {
  try {
    const input = {
      prompt: imagePrompt,
      scheduler: "K_EULER", // Optional, but shows customization
      width: 512,
      height: 512,
      num_inference_steps: 30,
    };

    const output = await replicate.run(
      "stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4", // ✅ verified working version
      { input }
    );

    if (!output || !Array.isArray(output) || !output[0]) {
      throw new Error("No image URL returned.");
    }

    // Fetch image from URL and convert to base64
    const response = await fetch(output[0]);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from ${output[0]}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return base64;

  } catch (err) {
    console.error("Error generating image via Replicate:", err);
    throw new Error("Failed to generate image.");
  }
};


export const processCode = async (req, res) => {
  const { code, requestType, imagePrompt } = req.body;

  if (!requestType) return res.status(400).json({ error: "requestType is required." });
  if (requestType !== 'generateImage' && !code) return res.status(400).json({ error: "Code is required." });
  if (requestType === 'generateImage' && !imagePrompt) return res.status(400).json({ error: "Image prompt is required." });

  let finalResponse = {
    explanation: null,
    improvements: null,
    bugs: null,
    testCases: null,
    highlights: [],
    modifiedCode: null,
    generatedImage: null,
    imagePrompt: null,
  };

  try {
    let prompt = "";

    switch (requestType) {
      case 'explain':
        prompt = `Analyze the following code snippet. Provide a detailed explanation of its purpose, functionality, and key parts. Identify and provide the exact line numbers (1-indexed) for the most important or interesting sections of the code that correspond to your explanation. Format your entire response as a JSON object within a markdown code block, like this:
\`\`\`json
{
  "explanation": "Your detailed explanation here, in multiple paragraphs.",
  "highlights": [
    {"start_line": 1, "end_line": 5, "reason": "Function definition and parameters."}
  ]
}
\`\`\`
Code:\n\`\`\`\n${code}\n\`\`\``;

        const explainResponse = await generateGeminiTextContent(prompt);
        const parsedExplain = extractAndParseJson(explainResponse);
        if (parsedExplain) {
          finalResponse.explanation = stripMarkdown(parsedExplain.explanation || '');
          finalResponse.highlights = parsedExplain.highlights || [];
        } else {
          finalResponse.explanation = stripMarkdown(explainResponse);
        }
        break;

      case 'improve':
        prompt = `Analyze the following code for potential improvements... (same format as above)`;
        const improveResponse = await generateGeminiTextContent(prompt);
        const parsedImprove = extractAndParseJson(improveResponse);
        if (parsedImprove) {
          finalResponse.improvements = stripMarkdown(parsedImprove.improvements || '');
          finalResponse.modifiedCode = stripMarkdown(parsedImprove.modified_code || '', 'code');
          finalResponse.highlights = parsedImprove.highlights || [];
        } else {
          finalResponse.improvements = stripMarkdown(improveResponse);
        }
        break;

      case 'debug':
        prompt = `Analyze the following code snippet to identify potential bugs... (same format as above)`;
        const debugResponse = await generateGeminiTextContent(prompt);
        const parsedDebug = extractAndParseJson(debugResponse);
        if (parsedDebug) {
          finalResponse.bugs = stripMarkdown(parsedDebug.bugs || '');
          finalResponse.modifiedCode = stripMarkdown(parsedDebug.modified_code || '', 'code');
          finalResponse.highlights = parsedDebug.highlights || [];
        } else {
          finalResponse.bugs = stripMarkdown(debugResponse);
        }
        break;

      case 'test':
        prompt = `Generate relevant unit test cases for the following code snippet. Assume Jest. Provide only the test code. Code:\n\`\`\`\n${code}\n\`\`\``;
        const testResponse = await generateGeminiTextContent(prompt);
        finalResponse.testCases = stripMarkdown(testResponse, 'code');
        break;

      case 'generateImage':
        finalResponse.generatedImage = await generateImageContent(imagePrompt);
        finalResponse.imagePrompt = imagePrompt;
        break;

      default:
        return res.status(400).json({ error: "Invalid request type." });
    }

    const newCodeSnippet = await CodeSnippet.create({
      code: code || null,
      requestType,
      explanation: finalResponse.explanation,
      improvements: finalResponse.improvements,
      bugs: finalResponse.bugs,
      testCases: finalResponse.testCases,
      highlights: JSON.stringify(finalResponse.highlights),
      modifiedCode: finalResponse.modifiedCode,
      generatedImage: finalResponse.generatedImage,
      imagePrompt: finalResponse.imagePrompt,
    });

    res.json({
      success: true,
      data: {
        id: newCodeSnippet.id,
        code: newCodeSnippet.code,
        requestType: newCodeSnippet.requestType,
        explanation: newCodeSnippet.explanation,
        improvements: newCodeSnippet.improvements,
        bugs: newCodeSnippet.bugs,
        testCases: newCodeSnippet.testCases,
        highlights: JSON.parse(newCodeSnippet.highlights || '[]'),
        modifiedCode: newCodeSnippet.modifiedCode,
        generatedImage: newCodeSnippet.generatedImage,
        imagePrompt: newCodeSnippet.imagePrompt,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "An error occurred while processing your request.", details: error.message });
  }
};

export const getSnippetHistory = async (req, res) => {
  try {
    const history = await CodeSnippet.findAll({
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const formattedHistory = history.map(item => ({
      ...item.toJSON(),
      highlights: JSON.parse(item.highlights || '[]'),
    }));

    res.json({ success: true, data: formattedHistory });
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch history.", details: error.message });
  }
};
