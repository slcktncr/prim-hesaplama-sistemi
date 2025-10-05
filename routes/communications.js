const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const CommunicationRecord = require('../models/CommunicationRecord');
const CommunicationYear = require('../models/CommunicationYear');
const CommunicationType = require('../models/CommunicationType');
const PenaltyRecord = require('../models/PenaltyRecord');
const User = require('../models/User');
const Sale = require('../models/Sale');
const { mapLegacyToDynamic, mapDynamicToLegacy, calculateTotalCommunication, getReportTypes } = require('../utils/communicationMapping');

const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/communications/today
// @desc    Bugünkü iletişim kaydını getir
// @access  Private
router.get('/today', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const record = await CommunicationRecord.findOne({
      salesperson: req.user.id,
      date: today
    });
    
    if (!record) {
      // Bugün için kayıt yoksa boş kayıt oluştur
      const newRecord = new CommunicationRecord({
        date: today,
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate(),
        salesperson: req.user.id
      });
      
      return res.json(newRecord);
    }
    
    res.json(record);
  } catch (error) {
    console.error('Today communication record error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   POST /api/communications/daily
// @desc    Günlük iletişim kaydı oluştur/güncelle (Dinamik sistem)
// @access  Private
router.post('/daily', [
  auth,
  body('date').optional().isISO8601().withMessage('Geçerli bir tarih giriniz')
], async (req, res) => {
  try {
    console.log('=== DAILY SAVE REQUEST (DYNAMIC) ===');
    console.log('Request body:', req.body);
    console.log('User ID:', req.user.id);
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const { date, notes, ...dynamicData } = req.body;

    // Eğer date gönderilmemişse bugünün tarihini kullan
    const recordDate = date ? new Date(date) : new Date();
    recordDate.setHours(0, 0, 0, 0);

    // Dinamik verileri validate et
    const communicationTypes = await CommunicationType.find({ isActive: true });
    const validationErrors = [];
    
    for (const [field, value] of Object.entries(dynamicData)) {
      if (field === 'notes') continue; // notes alanını atla
      
      const type = communicationTypes.find(t => t.code === field);
      if (type) {
        const numValue = parseInt(value) || 0;
        
        // Min/max değer kontrolü
        if (type.minValue > 0 && numValue < type.minValue) {
          validationErrors.push(`${type.name} minimum ${type.minValue} olmalıdır`);
        }
        if (type.maxValue > 0 && numValue > type.maxValue) {
          validationErrors.push(`${type.name} maksimum ${type.maxValue} olmalıdır`);
        }
        
        // Negatif değer kontrolü
        if (numValue < 0) {
          validationErrors.push(`${type.name} negatif olamaz`);
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: validationErrors.map(error => ({ msg: error }))
      });
    }

    // Mevcut kaydı bul veya yeni oluştur
    let record = await CommunicationRecord.findOne({
      salesperson: req.user.id,
      date: recordDate
    });

    // Legacy alan mapping
    const legacyMapping = {
      'WHATSAPP_INCOMING': 'whatsappIncoming',
      'CALL_INCOMING': 'callIncoming',
      'CALL_OUTGOING': 'callOutgoing',
      'MEETING_NEW_CUSTOMER': 'meetingNewCustomer',
      'MEETING_AFTER_SALE': 'meetingAfterSale'
    };

    if (record) {
      // Mevcut kaydı güncelle - dinamik alanları güncelle
      for (const [field, value] of Object.entries(dynamicData)) {
        if (field !== 'notes') {
          const numValue = parseInt(value) || 0;
          record[field] = numValue;
          
          // Legacy alanı da güncelle
          if (legacyMapping[field]) {
            record[legacyMapping[field]] = numValue;
          }
        }
      }
      record.notes = notes || '';
      record.isEntered = true;
      record.enteredAt = new Date();
      record.enteredBy = req.user.id;
    } else {
      // Yeni kayıt oluştur - dinamik alanları ekle
      const recordData = {
        date: recordDate,
        year: recordDate.getFullYear(),
        month: recordDate.getMonth() + 1,
        day: recordDate.getDate(),
        salesperson: req.user.id,
        notes: notes || '',
        isEntered: true,
        enteredAt: new Date(),
        enteredBy: req.user.id
      };

      // Dinamik alanları ekle
      for (const [field, value] of Object.entries(dynamicData)) {
        if (field !== 'notes') {
          const numValue = parseInt(value) || 0;
          recordData[field] = numValue;
          
          // Legacy alanı da ekle
          if (legacyMapping[field]) {
            recordData[legacyMapping[field]] = numValue;
          }
        }
      }

      record = new CommunicationRecord(recordData);
    }

    await record.save();

    res.json({
      message: 'İletişim kaydı başarıyla kaydedildi',
      data: record
    });

  } catch (error) {
    console.error('Daily communication record error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/communications/records
// @desc    İletişim kayıtlarını getir (filtrelenebilir)
// @access  Private
router.get('/records', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      year, 
      month, 
      salesperson,
      page = 1, 
      limit = 50,
      type = 'daily' // 'daily' veya 'yearly'
    } = req.query;

    // Eğer yearly isteniyorsa, geçmiş yıl verilerini getir
    if (type === 'yearly') {
      const years = await CommunicationYear.find({})
        .sort({ year: -1 })
        .limit(parseInt(limit));
      
      return res.json(years);
    }

    let query = {};

    // Tüm kullanıcılar artık herkesi görebilir
    if (salesperson && salesperson !== 'all') {
      query.salesperson = salesperson;
    }

    // Tarih filtreleri
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (year) {
      query.year = parseInt(year);
      if (month) {
        query.month = parseInt(month);
      }
    }

    const records = await CommunicationRecord.find(query)
      .populate('salesperson', 'name email')
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CommunicationRecord.countDocuments(query);

    res.json({
      records,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    console.error('Communication records fetch error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/communications/report
// @desc    İletişim raporu (kullanıcı bazlı)
// @access  Private
router.get('/report', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      salesperson
    } = req.query;

    // İletişim türlerini getir
    const communicationTypes = await CommunicationType.find({ isActive: true }).sort({ sortOrder: 1 });
    const reportTypes = getReportTypes(communicationTypes);

    let query = {};
    let salesQuery = {};

    // Tüm kullanıcılar artık herkesi görebilir
    if (salesperson && salesperson !== 'all') {
      query.salesperson = salesperson;
      salesQuery.salesperson = salesperson;
    }

    // Tarih filtreleri
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
      salesQuery.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Dinamik aggregation pipeline oluştur
    const groupFields = {
      _id: '$salesperson',
      totalCommunication: { $sum: '$totalCommunication' },
      recordCount: { $sum: 1 }
    };

    // Her iletişim türü için alan ekle
    reportTypes.forEach(type => {
      groupFields[type.code] = { $sum: { $ifNull: [`$${type.code}`, 0] } };
    });

    // Eski alanları da ekle (geriye uyumluluk için)
    const legacyFields = ['whatsappIncoming', 'callIncoming', 'callOutgoing', 'meetingNewCustomer', 'meetingAfterSale'];
    legacyFields.forEach(field => {
      if (!groupFields[field]) {
        groupFields[field] = { $sum: { $ifNull: [`$${field}`, 0] } };
      }
    });

    console.log('=== AGGREGATION PIPELINE DEBUG ===');
    console.log('Query:', JSON.stringify(query, null, 2));
    console.log('Group fields:', JSON.stringify(groupFields, null, 2));
    console.log('Report types:', reportTypes.map(t => ({ code: t.code, name: t.name })));

    const dailyRecords = await CommunicationRecord.aggregate([
      { $match: query },
      { $group: groupFields }
    ]);

    console.log('Aggregation result count:', dailyRecords.length);
    console.log('=== AGGREGATION PIPELINE DEBUG END ===');

    // Geçmiş yıl verilerini sadece gerekli durumlarda al
    const startYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
    const currentYear = new Date().getFullYear();
    
    // Geçmiş yılları dahil et (mevcut yıl hariç, çünkü günlük kayıtlar var)
    // Ama mevcut yıla ait geçmiş yıl verileri varsa onları da dahil et
    let historicalYears = [];
    if (startYear < currentYear) {
      // Sadece geçmiş yılları al
      historicalYears = await CommunicationYear.find({
        year: { $gte: startYear, $lt: currentYear }
      });
    }
    
    // Mevcut yıl için de geçmiş yıl verisi varsa dahil et
    const currentYearHistoricalData = await CommunicationYear.findOne({
      year: currentYear
    });
    
    if (currentYearHistoricalData) {
      historicalYears.push(currentYearHistoricalData);
    }
    
    console.log('=== DATE FILTER DEBUG ===');
    console.log('Start date:', startDate, 'End date:', endDate);
    console.log('Start year:', startYear, 'End year:', endYear, 'Current year:', currentYear);
    console.log('Will fetch historical years:', startYear < currentYear ? 'YES' : 'NO');
    console.log('Current year historical data:', currentYearHistoricalData ? 'EXISTS' : 'NOT EXISTS');
    console.log('Total historical years to process:', historicalYears.length);
    console.log('=== DATE FILTER DEBUG END ===');

    // Tüm aktif kullanıcıları al
    const User = require('../models/User');
    const Role = require('../models/Role');
    
    // Önce salesperson rolünü bul
    const salespersonRole = await Role.findOne({ name: 'salesperson' });
    if (!salespersonRole) {
      console.log('❌ Salesperson role not found');
      return res.status(404).json({ message: 'Satış temsilcisi rolü bulunamadı' });
    }
    
    const allUsers = await User.find({ 
      role: salespersonRole._id, // ObjectId kullan
      isActive: true, 
      isApproved: true 
    })
    .populate('role', 'name displayName')
    .select('_id name email role');

    console.log('=== BACKEND DEBUG START ===');
    console.log('All active users found:', allUsers.length);
    console.log('Active user names:', allUsers.map(u => u.name));
    console.log('Historical years found:', historicalYears.length);
    console.log('Historical years:', historicalYears.map(y => ({ year: y.year, type: y.type })));
    console.log('Daily records found:', dailyRecords.length);
    console.log('Daily records user IDs:', dailyRecords.map(r => r._id));
    
    // Detaylı debug - her kayıt için
    if (dailyRecords.length > 0) {
      console.log('=== DAILY RECORDS DETAIL ===');
      dailyRecords.forEach((record, index) => {
        console.log(`Record ${index + 1}:`);
        console.log('  User ID:', record._id);
        console.log('  Total Communication:', record.totalCommunication);
        console.log('  Record Count:', record.recordCount);
        console.log('  WhatsApp:', record.whatsappIncoming);
        console.log('  Call Incoming:', record.callIncoming);
        console.log('  Call Outgoing:', record.callOutgoing);
        console.log('  Meeting New:', record.meetingNewCustomer);
        console.log('  Meeting After:', record.meetingAfterSale);
        
        // Dinamik alanları kontrol et
        const dynamicFields = Object.keys(record).filter(key => 
          !['_id', 'totalCommunication', 'recordCount', 'whatsappIncoming', 'callIncoming', 'callOutgoing', 'meetingNewCustomer', 'meetingAfterSale'].includes(key)
        );
        if (dynamicFields.length > 0) {
          console.log('  Dynamic fields:', dynamicFields);
          dynamicFields.forEach(field => {
            console.log(`    ${field}:`, record[field]);
          });
        }
        console.log('---');
      });
    }
    
    console.log('=== BACKEND DEBUG END ===');

    // Geçmiş kullanıcıları sadece geçmiş yıl verileri varsa topla
    const allHistoricalUsers = new Map();
    if (historicalYears.length > 0) {
      historicalYears.forEach(yearData => {
        if (yearData.historicalUsers && yearData.historicalUsers.length > 0) {
          yearData.historicalUsers.forEach(histUser => {
            if (!allHistoricalUsers.has(histUser._id)) {
              allHistoricalUsers.set(histUser._id, {
                _id: histUser._id,
                name: histUser.name,
                email: histUser.email || '',
                isHistorical: true
              });
            }
          });
        }
      });
    }

    console.log('Historical users found:', allHistoricalUsers.size);
    console.log('Historical user names:', Array.from(allHistoricalUsers.values()).map(u => u.name));

    // Aktif kullanıcıları ve geçmiş kullanıcıları birleştir
    const allUsersIncludingHistorical = [
      ...allUsers.map(u => ({ ...u.toObject(), isHistorical: false })),
      ...Array.from(allHistoricalUsers.values())
    ];

    console.log('Total users (active + historical):', allUsersIncludingHistorical.length);
    console.log('Final user list:', allUsersIncludingHistorical.map(u => `${u.name} (${u.isHistorical ? 'historical' : 'active'})`));

    // Kullanıcı bazlı veri birleştirme
    const userBasedData = allUsersIncludingHistorical.map(user => {
      // Günlük kayıtlardan veri
      const dailyData = dailyRecords.find(d => d._id.toString() === user._id.toString()) || {
        whatsappIncoming: 0,
        callIncoming: 0,
        callOutgoing: 0,
        meetingNewCustomer: 0,
        meetingAfterSale: 0,
        totalCommunication: 0,
        recordCount: 0
      };

      // Eski alanları dinamik alanlara map et
      const mappedDailyData = {
        ...dailyData,
        WHATSAPP_INCOMING: dailyData.whatsappIncoming || 0,
        CALL_INCOMING: dailyData.callIncoming || 0,
        CALL_OUTGOING: dailyData.callOutgoing || 0,
        MEETING_NEW_CUSTOMER: dailyData.meetingNewCustomer || 0,
        MEETING_AFTER_SALE: dailyData.meetingAfterSale || 0
      };

      // Geçmiş yıl verilerinden veri
      let historicalData = {
        whatsappIncoming: 0,
        callIncoming: 0,
        callOutgoing: 0,
        meetingNewCustomer: 0,
        meetingAfterSale: 0,
        totalCommunication: 0
      };

      historicalYears.forEach(yearData => {
        console.log(`Processing year ${yearData.year} for user ${user.name} (historical: ${user.isHistorical})`);
        console.log('Year data keys:', Object.keys(yearData.toObject()));
        
        // Aylık verilerden topla (sadece aktif kullanıcılar için, 2025+ için)
        if (!user.isHistorical && yearData.monthlyData && yearData.monthlyData.size > 0) {
          console.log('Processing monthly data for active user, size:', yearData.monthlyData.size);
          for (let [month, monthData] of yearData.monthlyData) {
            if (monthData && monthData.get && monthData.get(user._id.toString())) {
              const userData = monthData.get(user._id.toString());
              historicalData.whatsappIncoming += userData.whatsappIncoming || 0;
              historicalData.callIncoming += userData.callIncoming || 0;
              historicalData.callOutgoing += userData.callOutgoing || 0;
              historicalData.meetingNewCustomer += userData.meetingNewCustomer || 0;
              historicalData.meetingAfterSale += userData.meetingAfterSale || 0;
              historicalData.totalCommunication += userData.totalCommunication || 0;
            }
          }
        }

        // Yıllık verilerden al (geçmiş yıllar için)
        if (yearData.yearlyCommunicationData) {
          console.log('Yearly communication data exists, type:', typeof yearData.yearlyCommunicationData);
          console.log('Is Map:', yearData.yearlyCommunicationData instanceof Map);
          console.log('Keys:', Array.from(yearData.yearlyCommunicationData.keys()));
          
          const userData = yearData.yearlyCommunicationData.get(user._id.toString());
          console.log(`User data for ${user.name}:`, userData);
          
          if (userData) {
            historicalData.whatsappIncoming += userData.whatsappIncoming || 0;
            historicalData.callIncoming += userData.callIncoming || 0;
            historicalData.callOutgoing += userData.callOutgoing || 0;
            historicalData.meetingNewCustomer += userData.meetingNewCustomer || 0;
            historicalData.meetingAfterSale += userData.meetingAfterSale || 0;
            historicalData.totalCommunication += userData.totalCommunication || 0;
          }
        }

        // Geçmiş yıl satış verilerini de dahil et
        if (yearData.yearlySalesData) {
          const salesData = yearData.yearlySalesData.get(user._id.toString());
          if (salesData) {
            console.log(`Historical sales data for ${user.name}:`, salesData);
            // Bu veriler frontend'te kullanılmak üzere ayrı bir field'da tutulacak
          }
        }
      });

      // Geçmiş verileri de map et
      const mappedHistoricalData = {
        ...historicalData,
        WHATSAPP_INCOMING: historicalData.whatsappIncoming || 0,
        CALL_INCOMING: historicalData.callIncoming || 0,
        CALL_OUTGOING: historicalData.callOutgoing || 0,
        MEETING_NEW_CUSTOMER: historicalData.meetingNewCustomer || 0,
        MEETING_AFTER_SALE: historicalData.meetingAfterSale || 0
      };

      // Toplam veri - dinamik
      const totalData = {};
      
      // Her iletişim türü için toplam hesapla
      reportTypes.forEach(type => {
        totalData[type.code] = (mappedDailyData[type.code] || 0) + (mappedHistoricalData[type.code] || 0);
      });
      
      // Eski alanları da ekle (geriye uyumluluk)
      const legacyFields = ['whatsappIncoming', 'callIncoming', 'callOutgoing', 'meetingNewCustomer', 'meetingAfterSale'];
      legacyFields.forEach(field => {
        totalData[field] = (dailyData[field] || 0) + (historicalData[field] || 0);
      });
      
      // Eski alanları dinamik alanlara da map et
      totalData.WHATSAPP_INCOMING = totalData.whatsappIncoming || 0;
      totalData.CALL_INCOMING = totalData.callIncoming || 0;
      totalData.CALL_OUTGOING = totalData.callOutgoing || 0;
      totalData.MEETING_NEW_CUSTOMER = totalData.meetingNewCustomer || 0;
      totalData.MEETING_AFTER_SALE = totalData.meetingAfterSale || 0;
      
      totalData.totalCommunication = dailyData.totalCommunication + historicalData.totalCommunication;

      return {
        salesperson: {
          _id: user._id,
          name: user.name,
          email: user.email
        },
        communication: totalData,
        recordCount: dailyData.recordCount
      };
    });

    console.log('User based data length:', userBasedData.length);
    console.log('User based data sample:', userBasedData.slice(0, 2));

    // Eğer hiç veri yoksa, en azından tüm kullanıcıları sıfır değerlerle göster
    if (userBasedData.length === 0) {
      console.log('No data found, returning all users with zero values');
      const zeroData = allUsers.map(user => ({
        salesperson: {
          _id: user._id,
          name: user.name,
          email: user.email
        },
        communication: {
          whatsappIncoming: 0,
          callIncoming: 0,
          callOutgoing: 0,
          meetingNewCustomer: 0,
          meetingAfterSale: 0,
          totalCommunication: 0
        },
        recordCount: 0
      }));
      console.log('Zero data sample:', zeroData.slice(0, 2));
      return res.json(zeroData);
    }

    // Response'a iletişim türlerini ekle
    const response = {
      data: userBasedData,
      communicationTypes: reportTypes,
      legacyFields: ['whatsappIncoming', 'callIncoming', 'callOutgoing', 'meetingNewCustomer', 'meetingAfterSale']
    };

    res.json(response);

  } catch (error) {
    console.error('Communication report error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/communications/daily-report
// @desc    Günlük detaylı rapor (iletişim + satış + iptal + değişiklik)
// @access  Private
router.get('/daily-report', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      salesperson
    } = req.query;

    let query = {};
    let salesQuery = {};

    // Tüm kullanıcılar artık herkesi görebilir
    if (salesperson && salesperson !== 'all') {
      query.salesperson = salesperson;
      salesQuery.salesperson = salesperson;
    }

    // Tarih filtreleri
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
      salesQuery.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    // Günlük iletişim kayıtları
    const communicationRecords = await CommunicationRecord.find(query)
      .populate('salesperson', 'name email')
      .sort({ date: -1 });

    // Günlük satış verileri (tüm türler)
    const salesRecords = await Sale.find(salesQuery)
      .populate('salesperson', 'name email')
      .populate('saleType', 'name color')
      .sort({ saleDate: -1 });

    // Geçmiş yıl verilerini de dahil et
    const startYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
    
    const historicalYears = await CommunicationYear.find({
      year: { $gte: startYear, $lte: endYear }
    });

    // Tüm aktif kullanıcıları al
    const Role = require('../models/Role');
    
    // Önce salesperson rolünü bul
    const salespersonRole = await Role.findOne({ name: 'salesperson' });
    if (!salespersonRole) {
      console.log('❌ Salesperson role not found in daily-report');
      return res.status(404).json({ message: 'Satış temsilcisi rolü bulunamadı' });
    }
    
    const allUsers = await User.find({ 
      role: salespersonRole._id, // ObjectId kullan
      isActive: true, 
      isApproved: true 
    })
    .populate('role', 'name displayName')
    .select('_id name email role');

    // Günlük bazda gruplama
    const dailyData = {};

    // İletişim verilerini grupla
    communicationRecords.forEach(record => {
      const dateKey = record.date.toISOString().split('T')[0];
      const userKey = record.salesperson._id.toString();
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {};
      }
      
      if (!dailyData[dateKey][userKey]) {
        dailyData[dateKey][userKey] = {
          date: record.date,
          salesperson: record.salesperson,
          communication: {
            whatsappIncoming: 0,
            callIncoming: 0,
            callOutgoing: 0,
            meetingNewCustomer: 0,
            meetingAfterSale: 0,
            totalCommunication: 0
          },
          sales: [],
          cancellations: [],
          modifications: []
        };
      }
      
      dailyData[dateKey][userKey].communication = {
        whatsappIncoming: record.whatsappIncoming,
        callIncoming: record.callIncoming,
        callOutgoing: record.callOutgoing,
        meetingNewCustomer: record.meetingNewCustomer,
        meetingAfterSale: record.meetingAfterSale,
        totalCommunication: record.totalCommunication
      };
    });

    // Satış verilerini grupla
    salesRecords.forEach(sale => {
      const dateKey = sale.saleDate.toISOString().split('T')[0];
      const userKey = sale.salesperson._id.toString();
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = {};
      }
      
      if (!dailyData[dateKey][userKey]) {
        dailyData[dateKey][userKey] = {
          date: sale.saleDate,
          salesperson: sale.salesperson,
          communication: {
            whatsappIncoming: 0,
            callIncoming: 0,
            callOutgoing: 0,
            meetingNewCustomer: 0,
            meetingAfterSale: 0,
            totalCommunication: 0
          },
          sales: [],
          cancellations: [],
          modifications: []
        };
      }
      
      const saleData = {
        _id: sale._id,
        saleType: sale.saleType,
        activitySalePrice: sale.activitySalePrice,
        listPrice: sale.listPrice,
        discountRate: sale.discountRate,
        contractNo: sale.contractNo,
        block: sale.block,
        apartmentNo: sale.apartmentNo,
        status: sale.status,
        isModified: sale.isModified,
        modificationHistory: sale.modificationHistory
      };
      
      if (sale.status === 'iptal') {
        dailyData[dateKey][userKey].cancellations.push(saleData);
      } else if (sale.isModified) {
        dailyData[dateKey][userKey].modifications.push(saleData);
      } else {
        dailyData[dateKey][userKey].sales.push(saleData);
      }
    });

    // Array formatına çevir ve sırala
    const result = [];
    Object.keys(dailyData).sort().reverse().forEach(dateKey => {
      Object.keys(dailyData[dateKey]).forEach(userKey => {
        result.push(dailyData[dateKey][userKey]);
      });
    });

    res.json(result);

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/communications/report-detailed
// @desc    Detaylı iletişim raporu (tarih bazlı gruplama)
// @access  Private
router.get('/report-detailed', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      year, 
      month, 
      salesperson,
      groupBy = 'day' // day, week, month, year
    } = req.query;

    let query = {};
    let salesQuery = {};

    // Tüm kullanıcılar artık herkesi görebilir
    if (salesperson && salesperson !== 'all') {
      query.salesperson = salesperson;
      salesQuery.salesperson = salesperson;
    }

    // Tarih filtreleri
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
      salesQuery.saleDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (year) {
      query.year = parseInt(year);
      if (month) {
        query.month = parseInt(month);
      }
      
      // Satış sorgusu için tarih aralığı
      const yearStart = new Date(year, month ? month - 1 : 0, 1);
      const yearEnd = new Date(year, month ? month : 12, 0, 23, 59, 59);
      salesQuery.saleDate = { $gte: yearStart, $lte: yearEnd };
    }

    // İletişim kayıtları
    const communicationRecords = await CommunicationRecord.find(query)
      .populate('salesperson', 'name email')
      .sort({ date: 1 });

    // Satış verileri
    const salesData = await Sale.find(salesQuery)
      .populate('salesperson', 'name email')
      .sort({ saleDate: 1 });

    // Gruplama işlemi
    const groupedData = groupDataByPeriod(communicationRecords, salesData, groupBy);

    res.json({
      groupBy,
      data: groupedData,
      summary: {
        totalCommunication: communicationRecords.reduce((sum, r) => sum + r.totalCommunication, 0),
        totalSales: salesData.filter(s => s.status === 'aktif').length,
        totalCancellations: salesData.filter(s => s.status === 'iptal').length,
        totalModifications: salesData.filter(s => s.isModified).length
      }
    });

  } catch (error) {
    console.error('Communication report error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// Veri gruplama fonksiyonu
function groupDataByPeriod(communicationRecords, salesData, groupBy) {
  const grouped = {};

  // İletişim kayıtlarını grupla
  communicationRecords.forEach(record => {
    const key = getGroupKey(record.date, groupBy);
    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        date: record.date,
        communication: {
          whatsappIncoming: 0,
          callIncoming: 0,
          callOutgoing: 0,
          meetingNewCustomer: 0,
          meetingAfterSale: 0,
          totalCommunication: 0
        },
        sales: {
          total: 0,
          cancelled: 0,
          modified: 0,
          kapora: 0,
          yazlik: 0,
          kislik: 0
        }
      };
    }

    grouped[key].communication.whatsappIncoming += record.whatsappIncoming;
    grouped[key].communication.callIncoming += record.callIncoming;
    grouped[key].communication.callOutgoing += record.callOutgoing;
    grouped[key].communication.meetingNewCustomer += record.meetingNewCustomer;
    grouped[key].communication.meetingAfterSale += record.meetingAfterSale;
    grouped[key].communication.totalCommunication += record.totalCommunication;
  });

  // Satış verilerini grupla
  salesData.forEach(sale => {
    const key = getGroupKey(sale.saleDate, groupBy);
    if (!grouped[key]) {
      grouped[key] = {
        period: key,
        date: sale.saleDate,
        communication: {
          whatsappIncoming: 0,
          callIncoming: 0,
          callOutgoing: 0,
          meetingNewCustomer: 0,
          meetingAfterSale: 0,
          totalCommunication: 0
        },
        sales: {
          total: 0,
          cancelled: 0,
          modified: 0,
          kapora: 0,
          yazlik: 0,
          kislik: 0
        }
      };
    }

    if (sale.status === 'aktif') {
      grouped[key].sales.total++;
    } else if (sale.status === 'iptal') {
      grouped[key].sales.cancelled++;
    }

    if (sale.isModified) {
      grouped[key].sales.modified++;
    }

    // Satış türü bazlı sayım
    if (sale.saleType === 'kapora') {
      grouped[key].sales.kapora++;
    } else if (sale.saleType === 'yazlik') {
      grouped[key].sales.yazlik++;
    } else if (sale.saleType === 'kislik') {
      grouped[key].sales.kislik++;
    }
  });

  return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Gruplama anahtarı oluşturma
function getGroupKey(date, groupBy) {
  const d = new Date(date);
  
  switch (groupBy) {
    case 'year':
      return d.getFullYear().toString();
    case 'month':
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case 'week':
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
    case 'day':
    default:
      return d.toISOString().split('T')[0];
  }
}

// @route   POST /api/communications/years
// @desc    Yeni yıl verisi oluştur
// @access  Private (Admin only)
router.post('/years', [auth, adminAuth], async (req, res) => {
  try {
    const { year, type, monthlyData, historicalUsers, yearlySalesData, yearlyCommunicationData } = req.body;
    
    // Yıl zaten var mı kontrol et
    const existingYear = await CommunicationYear.findOne({ year });
    if (existingYear) {
      return res.status(400).json({ message: 'Bu yıl zaten kayıtlı' });
    }

    const newYear = new CommunicationYear({
      year,
      type,
      monthlyData: monthlyData || {},
      historicalUsers: historicalUsers || [],
      yearlySalesData: yearlySalesData || {},
      yearlyCommunicationData: yearlyCommunicationData || {},
      isActive: type === 'active'
    });

    await newYear.save();

    res.json({
      message: 'Yıl verisi başarıyla oluşturuldu',
      year: newYear
    });

  } catch (error) {
    console.error('Create year error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   PUT /api/communications/years/:id
// @desc    Yıl verisini güncelle
// @access  Private (Admin only)
router.put('/years/:id', [auth, adminAuth], async (req, res) => {
  try {
    const { year, type, monthlyData, historicalUsers, yearlySalesData, yearlyCommunicationData } = req.body;
    
    const yearData = await CommunicationYear.findById(req.params.id);
    if (!yearData) {
      return res.status(404).json({ message: 'Yıl verisi bulunamadı' });
    }

    yearData.year = year;
    yearData.type = type;
    yearData.monthlyData = monthlyData || {};
    yearData.historicalUsers = historicalUsers || [];
    yearData.yearlySalesData = yearlySalesData || {};
    yearData.yearlyCommunicationData = yearlyCommunicationData || {};
    yearData.isActive = type === 'active';

    await yearData.save();

    res.json({
      message: 'Yıl verisi başarıyla güncellendi',
      year: yearData
    });

  } catch (error) {
    console.error('Update year error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   DELETE /api/communications/years/:id
// @desc    Yıl verisini sil
// @access  Private (Admin only)
router.delete('/years/:id', [auth, adminAuth], async (req, res) => {
  try {
    const yearData = await CommunicationYear.findById(req.params.id);
    if (!yearData) {
      return res.status(404).json({ message: 'Yıl verisi bulunamadı' });
    }

    await CommunicationYear.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Yıl verisi başarıyla silindi'
    });

  } catch (error) {
    console.error('Delete year error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

// @route   GET /api/communications/period-report
// @desc    Dönem bazlı iletişim raporu
// @access  Private
router.get('/period-report', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      salesperson,
      periodType = 'daily' // daily, weekly, monthly, yearly
    } = req.query;

    let query = {};

    // Tüm kullanıcılar artık herkesi görebilir
    if (salesperson && salesperson !== 'all') {
      query.salesperson = salesperson;
    }

    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // Dönem bazlı gruplama için aggregation pipeline
    let groupStage = {};
    let sortStage = {};

    switch (periodType) {
      case 'daily':
        groupStage = {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            day: { $dayOfMonth: '$date' },
            salesperson: '$salesperson'
          },
          date: { $first: '$date' }
        };
        sortStage = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
        break;
      case 'weekly':
        groupStage = {
          _id: {
            year: { $year: '$date' },
            week: { $week: '$date' },
            salesperson: '$salesperson'
          },
          date: { $first: '$date' }
        };
        sortStage = { '_id.year': 1, '_id.week': 1 };
        break;
      case 'monthly':
        groupStage = {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            salesperson: '$salesperson'
          },
          date: { $first: '$date' }
        };
        sortStage = { '_id.year': 1, '_id.month': 1 };
        break;
      case 'yearly':
        groupStage = {
          _id: {
            year: { $year: '$date' },
            salesperson: '$salesperson'
          },
          date: { $first: '$date' }
        };
        sortStage = { '_id.year': 1 };
        break;
    }

    // İletişim verilerini grupla
    const periodData = await CommunicationRecord.aggregate([
      { $match: query },
      {
        $group: {
          ...groupStage,
          whatsappIncoming: { $sum: '$whatsappIncoming' },
          callIncoming: { $sum: '$callIncoming' },
          callOutgoing: { $sum: '$callOutgoing' },
          meetingNewCustomer: { $sum: '$meetingNewCustomer' },
          meetingAfterSale: { $sum: '$meetingAfterSale' },
          totalCommunication: { $sum: '$totalCommunication' },
          recordCount: { $sum: 1 }
        }
      },
      { $sort: sortStage },
      {
        $lookup: {
          from: 'users',
          localField: '_id.salesperson',
          foreignField: '_id',
          as: 'salesperson'
        }
      },
      {
        $unwind: {
          path: '$salesperson',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 1,
          date: 1,
          salesperson: {
            _id: '$salesperson._id',
            name: '$salesperson.name',
            email: '$salesperson.email'
          },
          communication: {
            whatsappIncoming: '$whatsappIncoming',
            callIncoming: '$callIncoming',
            callOutgoing: '$callOutgoing',
            meetingNewCustomer: '$meetingNewCustomer',
            meetingAfterSale: '$meetingAfterSale',
            totalCommunication: '$totalCommunication'
          },
          recordCount: '$recordCount'
        }
      }
    ]);

    console.log(`Period report (${periodType}):`, periodData.length, 'records');

    res.json(periodData);
  } catch (error) {
    console.error('Period report error:', error);
    res.status(500).json({ message: 'Sunucu hatası' });
  }
});

module.exports = router;
