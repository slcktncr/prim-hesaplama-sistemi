const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const CommunicationRecord = require('../models/CommunicationRecord');
const CommunicationYear = require('../models/CommunicationYear');
const PenaltyRecord = require('../models/PenaltyRecord');
const User = require('../models/User');
const Sale = require('../models/Sale');

const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

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
// @desc    Günlük iletişim kaydı oluştur/güncelle
// @access  Private
router.post('/daily', [
  auth,
  body('whatsappIncoming').isInt({ min: 0 }).withMessage('WhatsApp gelen sayısı 0 veya pozitif olmalıdır'),
  body('callIncoming').isInt({ min: 0 }).withMessage('Gelen arama sayısı 0 veya pozitif olmalıdır'),
  body('callOutgoing').isInt({ min: 0 }).withMessage('Giden arama sayısı 0 veya pozitif olmalıdır'),
  body('meetingNewCustomer').isInt({ min: 0 }).withMessage('Yeni müşteri görüşme sayısı 0 veya pozitif olmalıdır'),
  body('meetingAfterSale').isInt({ min: 0 }).withMessage('Satış sonrası görüşme sayısı 0 veya pozitif olmalıdır'),
  body('date').isISO8601().withMessage('Geçerli bir tarih giriniz')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Geçersiz veri',
        errors: errors.array() 
      });
    }

    const {
      whatsappIncoming,
      callIncoming,
      callOutgoing,
      meetingNewCustomer,
      meetingAfterSale,
      date,
      notes
    } = req.body;

    const recordDate = new Date(date);
    recordDate.setHours(0, 0, 0, 0);

    // Mevcut kaydı bul veya yeni oluştur
    let record = await CommunicationRecord.findOne({
      salesperson: req.user.id,
      date: recordDate
    });

    if (record) {
      // Mevcut kaydı güncelle
      record.whatsappIncoming = whatsappIncoming;
      record.callIncoming = callIncoming;
      record.callOutgoing = callOutgoing;
      record.meetingNewCustomer = meetingNewCustomer;
      record.meetingAfterSale = meetingAfterSale;
      record.notes = notes;
      record.isEntered = true;
      record.enteredAt = new Date();
      record.enteredBy = req.user.id;
    } else {
      // Yeni kayıt oluştur
      record = new CommunicationRecord({
        date: recordDate,
        year: recordDate.getFullYear(),
        month: recordDate.getMonth() + 1,
        day: recordDate.getDate(),
        salesperson: req.user.id,
        whatsappIncoming,
        callIncoming,
        callOutgoing,
        meetingNewCustomer,
        meetingAfterSale,
        notes,
        isEntered: true,
        enteredAt: new Date(),
        enteredBy: req.user.id
      });
    }

    await record.save();

    res.json({
      message: 'İletişim kaydı başarıyla kaydedildi',
      record
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
      limit = 50 
    } = req.query;

    let query = {};

    // Admin değilse sadece kendi kayıtlarını görebilir
    if (req.user.role !== 'admin') {
      query.salesperson = req.user.id;
    } else if (salesperson && salesperson !== 'all') {
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
// @desc    İletişim raporu (satış verileriyle birlikte)
// @access  Private
router.get('/report', auth, async (req, res) => {
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

    // Admin değilse sadece kendi verilerini görebilir
    if (req.user.role !== 'admin') {
      query.salesperson = req.user.id;
      salesQuery.salesperson = req.user.id;
    } else if (salesperson && salesperson !== 'all') {
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

module.exports = router;
