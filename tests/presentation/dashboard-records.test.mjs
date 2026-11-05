import test from "node:test";
import assert from "node:assert/strict";
import {operationalDashboardRecords,operationalAutomationLogs} from "../../src/utils/dashboardRecords.ts";

test("only explicit tests leave the default dashboard; real and legacy records stay visible",()=>{
  const records=[{id:"legacy",name:"Test Customer"},{id:"real",is_test_data:false},{id:"test",is_test_data:true},{id:"unknown",is_test_data:null},{id:"bad-metadata",is_test_data:"true"}];
  const before=JSON.stringify(records);
  const visible=operationalDashboardRecords(records);
  assert.deepEqual(visible.map(row=>row.id),["legacy","real","unknown","bad-metadata"]);
  assert.equal(JSON.stringify(records),before);
  records[2].is_test_data=false;
  assert.equal(operationalDashboardRecords(records).length,5);
});


test("automation history is preserved while confirmed test-linked logs leave the default view",()=>{
  const logs=[{id:"test-log",rental_request_id:"test"},{id:"real-log",rental_request_id:"real"},{id:"system-log",rental_request_id:null}];
  const before=JSON.stringify(logs);
  assert.deepEqual(operationalAutomationLogs(logs,["test"]).map(log=>log.id),["real-log","system-log"]);
  assert.equal(JSON.stringify(logs),before);
  assert.equal(operationalAutomationLogs(logs,[]).length,3);
});
