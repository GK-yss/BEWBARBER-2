// --- CONFIGURATION ---
var SHEET_ID = "1VfDsy0BS7M3ztWuzPDHtfG8rxF6UNmzASKA3dngFMog";
var FOLDER_ID = "1J0IekxUXuKU7xbTLuX65fTlaxtPysFaH";
var SHEET_NAME_BOOKINGS = "BEWBARBER 2"; 
var SHEET_NAME_SETTINGS = "Settings"; 
var SHEET_NAME_CUSTOMERS = "Customers"; 

function doGet(e) {
  // ถ้าไม่มี action หรือเป็นการเข้าเว็บโดยตรง ให้แสดง HTML
  if (!e || !e.parameter || !e.parameter.action) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('BEW Barber Booking')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return handleRequest(e);
}

function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return responseJSON({ result: "error", message: "Server busy" });

  try {
    initSheets(); // ตรวจสอบและสร้าง Sheet
    
    if (!e || !e.parameter) return responseJSON({ result: "error", message: "No parameters" });
    var action = e.parameter.action;
    
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var bookingSheet = ss.getSheetByName(SHEET_NAME_BOOKINGS);
    var settingSheet = ss.getSheetByName(SHEET_NAME_SETTINGS);
    var customerSheet = ss.getSheetByName(SHEET_NAME_CUSTOMERS);

    // --- 1. ดึงข้อมูล (getData) ---
    if (action == "getData") {
      var settingsRaw = settingSheet.getDataRange().getValues();
      var bookingsRaw = bookingSheet.getDataRange().getValues();
      
      var shopStatus = "OPEN";
      var stylesData = [];
      var barbersData = [];
      
      // อ่าน Settings
      for (var i = 1; i < settingsRaw.length; i++) {
        if (settingsRaw[i][0] === "SHOP_STATUS") shopStatus = settingsRaw[i][1];
        if (settingsRaw[i][0] === "STYLES_DATA") { try { stylesData = JSON.parse(settingsRaw[i][1]); } catch(e) {} }
        if (settingsRaw[i][0] === "BARBERS_DATA") { try { barbersData = JSON.parse(settingsRaw[i][1]); } catch(e) {} }
      }
      if (barbersData.length === 0) {
        barbersData = [{ id: 1, name: "ช่างบิว (Master)", active: true }];
      }
      
      var busySlots = [];
      var allBookings = [];
      
      // อ่าน Bookings (เริ่มแถว 1 ข้าม Header)
      for (var i = 1; i < bookingsRaw.length; i++) {
        var row = bookingsRaw[i];
        // Col Index: 0=Time, 1=Name, 2=Phone, 3=Date, 4=Time, 5=Svc, 6=Price, 7=Barber, 8=Img, 9=Status, 10=Slip, 11=Hair, 12=Before, 13=After
        
        // เช็คคิวไม่ว่าง (ต้องไม่ถูก Rejected)
        if (row[3] && row[9] !== "Rejected") {
          var d = new Date(row[3]);
          var dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
          busySlots.push(dateStr + "|" + row[4] + "|" + row[7]);
        }
        
        // เก็บข้อมูลสำหรับ Admin Dashboard
        allBookings.push({
          id: i + 1, // ใช้เลขแถวเป็น ID
          timestamp: row[0],
          name: row[1], phone: row[2], date: row[3] ? Utilities.formatDate(new Date(row[3]), Session.getScriptTimeZone(), "yyyy-MM-dd") : "", 
          time: row[4], service: row[5], price: row[6], barber: row[7], 
          image: row[8], status: row[9] || 'Pending', 
          slip: row[10], hairCond: row[11], before: row[12], after: row[13]
        });
      }
      
      return responseJSON({ shopStatus: shopStatus, busySlots: busySlots, styles: stylesData, barbers: barbersData, allBookings: allBookings });
    }

    // --- 2. จองคิว (Booking) ---
    if (action == "booking") {
      // ตรวจสอบสถานะร้าน
      var settingsRaw = settingSheet.getDataRange().getValues();
      var currentStatus = "OPEN";
      for(var k=0; k<settingsRaw.length; k++) { if(settingsRaw[k][0] == "SHOP_STATUS") currentStatus = settingsRaw[k][1]; }
      if (currentStatus === "CLOSED") return responseJSON({ result: "error", message: "ร้านปิดรับคิวชั่วคราว" });

      // ตรวจสอบคิวซ้ำ
      if (e.parameter.barber !== "ช่างท่านไหนก็ได้") {
        var data = bookingSheet.getDataRange().getValues();
        for (var i = 1; i < data.length; i++) {
          if (data[i][3] && data[i][9] !== "Rejected") {
            var dateStr = Utilities.formatDate(new Date(data[i][3]), Session.getScriptTimeZone(), "yyyy-MM-dd");
            if (dateStr == e.parameter.date && data[i][4] == e.parameter.time && data[i][7] == e.parameter.barber) {
              return responseJSON({ result: "error", message: "เสียใจด้วย คิวนี้เพิ่งถูกจองไป" });
            }
          }
        }
      }

      // บันทึก (14 Columns)
      bookingSheet.appendRow([
        new Date(),                 // 1. Timestamp
        e.parameter.name,           // 2. Name
        e.parameter.phone,          // 3. Phone
        e.parameter.date,           // 4. Date
        e.parameter.time,           // 5. Time
        e.parameter.service,        // 6. Service
        e.parameter.price,          // 7. Price
        e.parameter.barber,         // 8. Barber
        e.parameter.imageUrl || "", // 9. Menu Image
        "Pending",                  // 10. Status (Default)
        e.parameter.slipUrl || "",  // 11. Slip URL
        "",                         // 12. Hair Condition
        "",                         // 13. Before
        ""                          // 14. After
      ]);
      return responseJSON({ result: "success" });
    }

    // --- 3. อัปเดตข้อมูล (Update Booking) ---
    if (action == "updateBooking") {
      var r = parseInt(e.parameter.rowIndex);
      if (r > 1) { // ต้องไม่แก้ Header
        if(e.parameter.name) bookingSheet.getRange(r, 2).setValue(e.parameter.name);
        if(e.parameter.phone) bookingSheet.getRange(r, 3).setValue(e.parameter.phone);
        if(e.parameter.date) bookingSheet.getRange(r, 4).setValue(e.parameter.date);
        if(e.parameter.time) bookingSheet.getRange(r, 5).setValue(e.parameter.time);
        if(e.parameter.barber) bookingSheet.getRange(r, 8).setValue(e.parameter.barber);
        if(e.parameter.status) bookingSheet.getRange(r, 10).setValue(e.parameter.status);
        if(e.parameter.hairCond) bookingSheet.getRange(r, 12).setValue(e.parameter.hairCond);
        if(e.parameter.beforeImg) bookingSheet.getRange(r, 13).setValue(e.parameter.beforeImg);
        if(e.parameter.afterImg) bookingSheet.getRange(r, 14).setValue(e.parameter.afterImg);
        return responseJSON({ result: "success" });
      }
      return responseJSON({ result: "error", message: "Invalid Row" });
    }

    // --- 4. อัปโหลดรูป (Upload Image) ---
    if (action == "uploadImage") {
      var decoded = Utilities.base64Decode(e.parameter.fileData);
      var blob = Utilities.newBlob(decoded, e.parameter.mimeType, e.parameter.fileName);
      var folder = DriveApp.getFolderById(FOLDER_ID);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return responseJSON({ result: "success", url: "https://drive.google.com/uc?export=view&id=" + file.getId() });
    }

    // --- 5. บันทึก Settings (Toggle Status / Save Styles) ---
    if (action == "toggleStatus") {
       saveSettingValue(settingSheet, "SHOP_STATUS", e.parameter.status);
       return responseJSON({result:"success"});
    }
    if (action == "saveStyles") {
       saveSettingValue(settingSheet, "STYLES_DATA", e.parameter.styles);
       return responseJSON({result:"success"});
    }
    
    // --- 6. เช็คคิวลูกค้า (Check Status) ---
    if (action == "checkBooking") {
       // ใช้ Logic เดียวกับ getData แล้ว Filter ที่ Frontend หรือจะ Filter ที่นี่ก็ได้
       // เพื่อความง่าย ให้ Frontend ใช้ getData แล้ว filter เอง หรือจะเขียนแยกก็ได้
       // ในที่นี้เราจะให้ Frontend ใช้ getData จัดการ
       return responseJSON({ result: "use_getData" });
    }

    // --- 7. อัพโหลดรูปทรงผมใหม่ (New Hairstyle Image) ---
    if (action == "uploadHairstyleImage") {
      var decoded = Utilities.base64Decode(e.parameter.fileData);
      var blob = Utilities.newBlob(decoded, e.parameter.mimeType, e.parameter.fileName);
      var hairstyleFolder = getHairstyleFolder();
      var file = hairstyleFolder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      var imageUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
      var thumbnailUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
      return responseJSON({ 
        result: "success", 
        url: imageUrl, 
        thumbnailUrl: thumbnailUrl,
        fileId: file.getId(),
        fileName: file.getName()
      });
    }

    // --- 8. ดึงรายการรูปทรงผมทั้งหมด (Get All Hairstyle Images) ---
    if (action == "getHairstyleImages") {
      var hairstyleFolder = getHairstyleFolder();
      var files = hairstyleFolder.getFiles();
      var images = [];
      while (files.hasNext()) {
        var file = files.next();
        images.push({
          id: file.getId(),
          name: file.getName(),
          url: "https://drive.google.com/uc?export=view&id=" + file.getId(),
          thumbnailUrl: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000",
          created: file.getDateCreated()
        });
      }
      images.sort(function(a, b) { return b.created - a.created; });
      return responseJSON({ result: "success", images: images, count: images.length });
    }

    // --- 9. ลบรูปทรงผม (Delete Hairstyle Image) ---
    if (action == "deleteHairstyleImage") {
      var fileId = e.parameter.fileId;
      if (!fileId) return responseJSON({ result: "error", message: "Missing fileId" });
      try {
        var file = DriveApp.getFileById(fileId);
        file.setTrashed(true);
        return responseJSON({ result: "success", message: "Image deleted" });
      } catch(err) {
        return responseJSON({ result: "error", message: "File not found or cannot delete" });
      }
    }

    // --- 10. ดึงข้อมูลช่าง (Get Barbers) ---
    if (action == "getBarbers") {
      var settingsRaw = settingSheet.getDataRange().getValues();
      var barbersData = [];
      for (var i = 1; i < settingsRaw.length; i++) {
        if (settingsRaw[i][0] === "BARBERS_DATA") { 
          try { barbersData = JSON.parse(settingsRaw[i][1]); } catch(e) { barbersData = []; } 
        }
      }
      if (barbersData.length === 0) {
        barbersData = [{ id: 1, name: "ช่างบิว (Master)", active: true }];
      }
      return responseJSON({ result: "success", barbers: barbersData });
    }

    // --- 11. บันทึกข้อมูลช่าง (Save Barbers) ---
    if (action == "saveBarbers") {
      saveSettingValue(settingSheet, "BARBERS_DATA", e.parameter.barbers);
      return responseJSON({ result: "success" });
    }

    // --- 12. เพิ่มช่างใหม่ (Add Barber) ---
    if (action == "addBarber") {
      var settingsRaw = settingSheet.getDataRange().getValues();
      var barbersData = [];
      for (var i = 1; i < settingsRaw.length; i++) {
        if (settingsRaw[i][0] === "BARBERS_DATA") { 
          try { barbersData = JSON.parse(settingsRaw[i][1]); } catch(e) { barbersData = []; } 
        }
      }
      if (barbersData.length === 0) {
        barbersData = [{ id: 1, name: "ช่างบิว (Master)", active: true }];
      }
      var newId = Math.max(...barbersData.map(function(b) { return b.id; }), 0) + 1;
      barbersData.push({ id: newId, name: e.parameter.name || "ช่างใหม่", active: true });
      saveSettingValue(settingSheet, "BARBERS_DATA", JSON.stringify(barbersData));
      return responseJSON({ result: "success", barbers: barbersData });
    }

    // --- 13. ลบช่าง (Delete Barber) ---
    if (action == "deleteBarber") {
      var barberId = parseInt(e.parameter.id);
      var settingsRaw = settingSheet.getDataRange().getValues();
      var barbersData = [];
      for (var i = 1; i < settingsRaw.length; i++) {
        if (settingsRaw[i][0] === "BARBERS_DATA") { 
          try { barbersData = JSON.parse(settingsRaw[i][1]); } catch(e) { barbersData = []; } 
        }
      }
      barbersData = barbersData.filter(function(b) { return b.id !== barberId; });
      saveSettingValue(settingSheet, "BARBERS_DATA", JSON.stringify(barbersData));
      return responseJSON({ result: "success", barbers: barbersData });
    }

    // --- 14. อัพเดทช่าง (Update Barber) ---
    if (action == "updateBarber") {
      var barberId = parseInt(e.parameter.id);
      var barberName = e.parameter.name;
      var barberActive = e.parameter.active === "true";
      var settingsRaw = settingSheet.getDataRange().getValues();
      var barbersData = [];
      for (var i = 1; i < settingsRaw.length; i++) {
        if (settingsRaw[i][0] === "BARBERS_DATA") { 
          try { barbersData = JSON.parse(settingsRaw[i][1]); } catch(e) { barbersData = []; } 
        }
      }
      for (var j = 0; j < barbersData.length; j++) {
        if (barbersData[j].id === barberId) {
          barbersData[j].name = barberName;
          barbersData[j].active = barberActive;
        }
      }
      saveSettingValue(settingSheet, "BARBERS_DATA", JSON.stringify(barbersData));
      return responseJSON({ result: "success", barbers: barbersData });
    }

    // --- 15. ล็อกอินลูกค้า (Customer Login) ---
    if (action == "customerLogin") {
      var customerSheet = ss.getSheetByName(SHEET_NAME_CUSTOMERS);
      var customersRaw = customerSheet.getDataRange().getValues();
      var phone = e.parameter.phone;
      var password = e.parameter.password || "";
      
      for (var i = 1; i < customersRaw.length; i++) {
        if (String(customersRaw[i][1]) === phone) {
          if (password === "" || String(customersRaw[i][2]) === password) {
            return responseJSON({ 
              result: "success", 
              customer: {
                id: i + 1,
                name: customersRaw[i][0],
                phone: customersRaw[i][1],
                password: customersRaw[i][2],
                hairCondition: customersRaw[i][3] || "",
                habits: customersRaw[i][4] || "",
                notes: customersRaw[i][5] || "",
                createdAt: customersRaw[i][6]
              }
            });
          }
        }
      }
      return responseJSON({ result: "error", message: "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง" });
    }

    // --- 16. สมัครสมาชิก (Customer Register) ---
    if (action == "customerRegister") {
      var customerSheet = ss.getSheetByName(SHEET_NAME_CUSTOMERS);
      var customersRaw = customerSheet.getDataRange().getValues();
      var phone = e.parameter.phone;
      var name = e.parameter.name || "";
      var password = e.parameter.password || "1234";
      
      for (var i = 1; i < customersRaw.length; i++) {
        if (String(customersRaw[i][1]) === phone) {
          return responseJSON({ result: "error", message: "เบอร์โทรนี้ลงทะเบียนแล้ว" });
        }
      }
      
      customerSheet.appendRow([name, phone, password, "", "", "", new Date()]);
      return responseJSON({ result: "success", message: "ลงทะเบียนสำเร็จ" });
    }

    // --- 17. อัพเดทข้อมูลลูกค้า (Update Customer Profile) ---
    if (action == "updateCustomer") {
      var rowIndex = parseInt(e.parameter.rowIndex);
      if (rowIndex > 1) {
        if (e.parameter.name) customerSheet.getRange(rowIndex, 1).setValue(e.parameter.name);
        if (e.parameter.password) customerSheet.getRange(rowIndex, 2).setValue(e.parameter.password);
        if (e.parameter.phone) customerSheet.getRange(rowIndex, 2).setValue(e.parameter.phone);
        if (e.parameter.hairCondition) customerSheet.getRange(rowIndex, 4).setValue(e.parameter.hairCondition);
        if (e.parameter.habits) customerSheet.getRange(rowIndex, 5).setValue(e.parameter.habits);
        if (e.parameter.notes) customerSheet.getRange(rowIndex, 6).setValue(e.parameter.notes);
        return responseJSON({ result: "success" });
      }
      return responseJSON({ result: "error", message: "Invalid Row" });
    }

    // --- 18. ดึงข้อมูลลูกค้าทั้งหมด (Get All Customers - Admin) ---
    if (action == "getCustomers") {
      var customerSheet = ss.getSheetByName(SHEET_NAME_CUSTOMERS);
      var customersRaw = customerSheet.getDataRange().getValues();
      var customers = [];
      for (var i = 1; i < customersRaw.length; i++) {
        customers.push({
          id: i + 1,
          name: customersRaw[i][0],
          phone: customersRaw[i][1],
          password: customersRaw[i][2],
          hairCondition: customersRaw[i][3] || "",
          habits: customersRaw[i][4] || "",
          notes: customersRaw[i][5] || "",
          createdAt: customersRaw[i][6]
        });
      }
      return responseJSON({ result: "success", customers: customers });
    }

    return responseJSON({ result: "error", message: "Invalid Action" });

  } catch (err) {
    return responseJSON({ result: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// Helper บันทึกค่าลง Settings
function saveSettingValue(sheet, key, value) {
  var data = sheet.getDataRange().getValues();
  for(var i=0; i<data.length; i++){ 
    if(data[i][0] == key){ 
      sheet.getRange(i+1, 2).setValue(value); 
      return;
    }
  }
  sheet.appendRow([key, value]);
}

// สร้าง Sheet ถ้ายังไม่มี
function initSheets() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  if (!ss.getSheetByName(SHEET_NAME_SETTINGS)) {
    var s = ss.insertSheet(SHEET_NAME_SETTINGS);
    s.appendRow(["Key", "Value"]); s.appendRow(["SHOP_STATUS", "OPEN"]); s.appendRow(["STYLES_DATA", "[]"]); s.appendRow(["BARBERS_DATA", '[{"id":1,"name":"ช่างบิว (Master)","active":true}]']);
  }
  if (!ss.getSheetByName(SHEET_NAME_BOOKINGS)) {
    var s = ss.insertSheet(SHEET_NAME_BOOKINGS);
    s.appendRow(["Timestamp", "Name", "Phone", "Date", "Time", "Service", "Price", "Barber", "ImageURL", "Status", "SlipURL", "HairCondition", "BeforeImg", "AfterImg"]);
  }
  if (!ss.getSheetByName(SHEET_NAME_CUSTOMERS)) {
    var s = ss.insertSheet(SHEET_NAME_CUSTOMERS);
    s.appendRow(["Name", "Phone", "Password", "HairCondition", "Habits", "Notes", "CreatedAt"]);
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Helper: ดึงหรือสร้าง Folder สำหรับเก็บรูปทรงผม
function getHairstyleFolder() {
  var mainFolder = DriveApp.getFolderById(FOLDER_ID);
  var folderName = "BEW_Hairstyles";
  var folders = mainFolder.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return mainFolder.createFolder(folderName);
  }
}