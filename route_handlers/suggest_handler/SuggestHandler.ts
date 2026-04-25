import { Request, Response } from 'express';
import BaseHandler from '../base_handler/BaseHandler';

export default class SuggestHandler extends BaseHandler {
    async handle(req: Request, res: Response) {
        try {
            const rawQuery = (req.query.q as string) || '';
            const query = rawQuery.trim().toLowerCase();
            
            if (!query || query.length < 2) {
                return res.json({ success: true, suggestions: [] });
            }

            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const safeQuery = escapeRegExp(query);
            const regex = new RegExp(`^${safeQuery}`, 'i');

            const suggestions: string[] = [];

            // 1. Suggest Wallet Addresses (using balancesCollection for O(1) indexed prefix matching)
            if (query.startsWith('0x')) {
                const wallets = await this.node.ledger.balancesCollection!.find({
                    walletAddress: { $regex: regex }
                }).limit(3).toArray();
                wallets.forEach(w => suggestions.push(w.walletAddress));
            }

            // 2. Suggest Block Hashes (using _id primary index for O(1) prefix matching)
            if (query.length >= 4 && !query.startsWith('0x')) {
                const blocks = await this.node.ledger.collection!.find({
                    _id: { $regex: regex }
                } as any).limit(3).toArray();
                blocks.forEach(b => suggestions.push(b.hash as string));
            }

            // Deduplicate and enforce hard limit
            const uniqueSuggestions = Array.from(new Set(suggestions)).slice(0, 5);

            res.json({ success: true, suggestions: uniqueSuggestions });
        } catch (error: any) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
