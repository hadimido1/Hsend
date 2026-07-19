const Database = require('better-sqlite3');
const db = new Database('data/chat.db');
try { db.exec("ALTER TABLE users ADD COLUMN google_uid TEXT"); } catch(e){}
try { db.exec("ALTER TABLE users ADD COLUMN name TEXT"); } catch(e){}
try { db.exec("ALTER TABLE users ADD COLUMN age INTEGER"); } catch(e){}
try { db.exec("ALTER TABLE users ADD COLUMN country TEXT"); } catch(e){}
try { db.exec("ALTER TABLE users ADD COLUMN last_seen INTEGER"); } catch(e){}
