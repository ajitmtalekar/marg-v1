import express from 'express';
import contactRouter from './contact.js';

export default function routes() {
  const router = express.Router();
  router.use('/contact', contactRouter);
  return router;
}