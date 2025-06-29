import { Router } from 'express';
import { processCode,getSnippetHistory } from '../controllers/CodeController.js';

const router = Router();

// Route to process code snippets
router.post('/process', processCode);

// Route to get a history of processed snippets
router.get('/history', getSnippetHistory);

export default router;