import test from 'node:test';
import assert from 'node:assert/strict';
import { isArdaInventoryFeatureEnabled, validateInventoryAccess } from '../inventory/inventory-access';
const tenant={id:'a',slug:'arda',settings:{features:{hasInventoryReports:true}}};
test('features fail closed for absent settings and other tenants',()=>{
 assert.equal(isArdaInventoryFeatureEnabled({...tenant,settings:{}},'hasInventoryReports'),false);
 assert.equal(isArdaInventoryFeatureEnabled({...tenant,slug:'goodfellow'},'hasInventoryReports'),false);
 assert.equal(isArdaInventoryFeatureEnabled(tenant,'hasInventoryReports'),true);
});
test('session and office access cannot cross tenants or offices',()=>{
 assert.throws(()=>validateInventoryAccess(tenant,{id:'u',tenantId:'b'},[1]),/tenant/i);
 assert.throws(()=>validateInventoryAccess(tenant,{id:'u'},[1]),/tenant/i);
 const access=validateInventoryAccess(tenant,{id:'u',tenantId:'a'},[1]);
 assert.deepEqual(access.allowedOfficeIds,[1]);
});
