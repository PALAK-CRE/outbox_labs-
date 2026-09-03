import { Request, Response } from 'express';
import { SearchService } from '../services/searchService.js';

export class SearchController {
  public static async search(req: Request, res: Response) {
    try {
      const { q, status, page, limit, senderEmail } = req.query;

      const result = await SearchService.searchEmails({
        query: q as string,
        status: status as string,
        senderEmail: senderEmail as string,
        userId: req.user?.id,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });

      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('❌ Search error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}
