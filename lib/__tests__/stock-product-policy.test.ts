import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresStock, parseStockSelection } from '../inventory/stock-product-policy';
const settings={inventory:{stockProductIds:[7]}};
test('configured stock products require selection even when metadata was lost',()=>{
 assert.equal(requiresStock(settings,7,null),true);
 assert.equal(requiresStock(settings,8,null),false);
 assert.equal(requiresStock(settings,8,{inventoryItemId:'seed'}),true);
 assert.throws(()=>parseStockSelection(null),/stock selection/i);
});
test('selection rejects malformed quantities and office identifiers',()=>{
 const s={inventoryItemId:'seed',fineractOfficeId:1,currencyCode:'usd',quantity:'2',unitValue:'4'};
 assert.equal(parseStockSelection(s).currencyCode,'USD');
 for(const q of ['0','-1','2abc','NaN','0.0001']) assert.throws(()=>parseStockSelection({...s,quantity:q}));
 assert.throws(()=>parseStockSelection({...s,fineractOfficeId:0}));
});
