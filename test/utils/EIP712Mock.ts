import * as crypto from 'crypto';

import { ethers } from 'ethers';


import { EIP712_DOMAIN, EIP712_SCHEMAS, normalizeBlockForSignature } from '../../crypto_utils/EIP712Types';
import type { Block, BlockType } from '../../types';

export const createSignedMockBlock = async (
    wallet: ethers.HDNodeWallet | ethers.Wallet,
    blockType: Exclude<BlockType, undefined>,
    payloadObj: any,
    metadataIndex: number = 1,
    previousHash: string = ''
): Promise<Block> => {
    const block: Block = {
        type: blockType,
        metadata: { index: metadataIndex, timestamp: Date.now() },
        previousHash: previousHash,
        signerAddress: wallet.address,
        payload: payloadObj,
        signature: ''
    } as Block;

    const value = normalizeBlockForSignature(block);
    const schema = EIP712_SCHEMAS[blockType];

    const signature = await wallet.signTypedData(EIP712_DOMAIN, schema, value.payload ? value : value);
    block.signature = signature;
    
    // Natively structure placeholder hash to pacify MongoDB indexes downstream natively.
    const blockToHash = { ...block };
    delete blockToHash.hash;
    block.hash = crypto.createHash('sha256').update(JSON.stringify(blockToHash)).digest('hex');

    return block;
};
