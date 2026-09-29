INSERT INTO public.machines (id, organization_id, station_id, name, vendor, model, protocol, endpoint, connection_mode, tags, commands, status, notes) VALUES
('MC-SIFT-01','ORG-01','ST-SIFT-01','Plansifter (mock)','Bühler','MPAV','mqtt','mqtt://broker.plant.local:1883','simulated',
 '[{"name":"Vibration","unit":"mm/s","address":"plant/mill/sifter/vibration","min":0,"max":7},{"name":"Throughput","unit":"t/h","address":"plant/mill/sifter/throughput","min":2,"max":12}]',
 '[{"name":"Start","address":"plant/mill/sifter/cmd"},{"name":"Stop","address":"plant/mill/sifter/cmd","safety":true}]','offline','Mock MQTT / Sparkplug B device'),
('MC-PACK-02','ORG-01','ST-PACK-01','Bag sealer (mock)','Siemens','S7-1500','s7','10.0.0.40 rack 0 slot 1','simulated',
 '[{"name":"Seal temp","unit":"°C","address":"DB10.DBD4","min":160,"max":190,"hold_on_breach":true},{"name":"Bags/min","unit":"bpm","address":"DB10.DBD8","min":10,"max":40}]',
 '[{"name":"Set seal temp","address":"DB10.DBD20","params":"°C"},{"name":"E-stop reset","address":"DB10.DBX30.0","safety":true}]','offline','Mock Siemens S7 PLC'),
('MC-PACK-03','ORG-01','ST-PACK-01','Palletizer (mock)','Rockwell','CompactLogix','ethernet_ip','10.0.0.30 slot 0','simulated',
 '[{"name":"Layers","unit":"","address":"Program:Main.Layers","min":0,"max":10}]','[{"name":"Start cycle","address":"Program:Main.StartCmd"}]','offline','Mock EtherNet/IP controller'),
('MC-MILL-02','ORG-01','ST-MILL-01','Wheat conditioner (mock)','Pepperl','RTU box','modbus_rtu','/dev/ttyUSB0 9600 8N1 unit 2','simulated',
 '[{"name":"Moisture","unit":"%","address":"HR40010","min":14,"max":17}]','[{"name":"Set water dosing","address":"HR40020","params":"l/h"}]','offline','Mock Modbus RTU device'),
('MC-UTIL-01','ORG-01',NULL,'Silo climate (mock)','Honeywell','BACnet controller','bacnet','10.0.0.50 device 1001','simulated',
 '[{"name":"Silo temp","unit":"°C","address":"analog-input:1","min":5,"max":30}]','[{"name":"Fan on","address":"binary-output:1"}]','offline','Mock BACnet/IP building controller'),
('MC-UTIL-02','ORG-01',NULL,'Substation meter (mock)','SEL','RTU','dnp3','10.0.0.60:20000 outstation 10','simulated',
 '[{"name":"Power","unit":"kW","address":"AI 0","min":0,"max":900}]','[{"name":"Breaker trip","address":"BO 1","safety":true}]','offline','Mock DNP3 outstation')
ON CONFLICT (id) DO NOTHING;