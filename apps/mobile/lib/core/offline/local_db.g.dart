// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'local_db.dart';

// ignore_for_file: type=lint
class $LocalScansTable extends LocalScans
    with TableInfo<$LocalScansTable, LocalScan> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalScansTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
      'id', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      clientDefault: _uuid);
  static const VerificationMeta _barcodeMeta =
      const VerificationMeta('barcode');
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
      'barcode', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _imageB64Meta =
      const VerificationMeta('imageB64');
  @override
  late final GeneratedColumn<String> imageB64 = GeneratedColumn<String>(
      'image_b64', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _ocrRawTextMeta =
      const VerificationMeta('ocrRawText');
  @override
  late final GeneratedColumn<String> ocrRawText = GeneratedColumn<String>(
      'ocr_raw_text', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
      'status', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      defaultValue: const Constant('pending'));
  static const VerificationMeta _errorMsgMeta =
      const VerificationMeta('errorMsg');
  @override
  late final GeneratedColumn<String> errorMsg = GeneratedColumn<String>(
      'error_msg', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _createdAtMeta =
      const VerificationMeta('createdAt');
  @override
  late final GeneratedColumn<String> createdAt = GeneratedColumn<String>(
      'created_at', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      clientDefault: _now);
  static const VerificationMeta _syncedAtMeta =
      const VerificationMeta('syncedAt');
  @override
  late final GeneratedColumn<String> syncedAt = GeneratedColumn<String>(
      'synced_at', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  @override
  List<GeneratedColumn> get $columns => [
        id,
        barcode,
        imageB64,
        ocrRawText,
        status,
        errorMsg,
        createdAt,
        syncedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_scans';
  @override
  VerificationContext validateIntegrity(Insertable<LocalScan> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('barcode')) {
      context.handle(_barcodeMeta,
          barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta));
    }
    if (data.containsKey('image_b64')) {
      context.handle(_imageB64Meta,
          imageB64.isAcceptableOrUnknown(data['image_b64']!, _imageB64Meta));
    }
    if (data.containsKey('ocr_raw_text')) {
      context.handle(
          _ocrRawTextMeta,
          ocrRawText.isAcceptableOrUnknown(
              data['ocr_raw_text']!, _ocrRawTextMeta));
    }
    if (data.containsKey('status')) {
      context.handle(_statusMeta,
          status.isAcceptableOrUnknown(data['status']!, _statusMeta));
    }
    if (data.containsKey('error_msg')) {
      context.handle(_errorMsgMeta,
          errorMsg.isAcceptableOrUnknown(data['error_msg']!, _errorMsgMeta));
    }
    if (data.containsKey('created_at')) {
      context.handle(_createdAtMeta,
          createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta));
    }
    if (data.containsKey('synced_at')) {
      context.handle(_syncedAtMeta,
          syncedAt.isAcceptableOrUnknown(data['synced_at']!, _syncedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalScan map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalScan(
      id: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}id'])!,
      barcode: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}barcode']),
      imageB64: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}image_b64']),
      ocrRawText: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}ocr_raw_text']),
      status: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}status'])!,
      errorMsg: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}error_msg']),
      createdAt: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}created_at'])!,
      syncedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}synced_at']),
    );
  }

  @override
  $LocalScansTable createAlias(String alias) {
    return $LocalScansTable(attachedDatabase, alias);
  }
}

class LocalScan extends DataClass implements Insertable<LocalScan> {
  final String id;
  final String? barcode;
  final String? imageB64;
  final String? ocrRawText;
  final String status;
  final String? errorMsg;
  final String createdAt;
  final String? syncedAt;
  const LocalScan(
      {required this.id,
      this.barcode,
      this.imageB64,
      this.ocrRawText,
      required this.status,
      this.errorMsg,
      required this.createdAt,
      this.syncedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || barcode != null) {
      map['barcode'] = Variable<String>(barcode);
    }
    if (!nullToAbsent || imageB64 != null) {
      map['image_b64'] = Variable<String>(imageB64);
    }
    if (!nullToAbsent || ocrRawText != null) {
      map['ocr_raw_text'] = Variable<String>(ocrRawText);
    }
    map['status'] = Variable<String>(status);
    if (!nullToAbsent || errorMsg != null) {
      map['error_msg'] = Variable<String>(errorMsg);
    }
    map['created_at'] = Variable<String>(createdAt);
    if (!nullToAbsent || syncedAt != null) {
      map['synced_at'] = Variable<String>(syncedAt);
    }
    return map;
  }

  LocalScansCompanion toCompanion(bool nullToAbsent) {
    return LocalScansCompanion(
      id: Value(id),
      barcode: barcode == null && nullToAbsent
          ? const Value.absent()
          : Value(barcode),
      imageB64: imageB64 == null && nullToAbsent
          ? const Value.absent()
          : Value(imageB64),
      ocrRawText: ocrRawText == null && nullToAbsent
          ? const Value.absent()
          : Value(ocrRawText),
      status: Value(status),
      errorMsg: errorMsg == null && nullToAbsent
          ? const Value.absent()
          : Value(errorMsg),
      createdAt: Value(createdAt),
      syncedAt: syncedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(syncedAt),
    );
  }

  factory LocalScan.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalScan(
      id: serializer.fromJson<String>(json['id']),
      barcode: serializer.fromJson<String?>(json['barcode']),
      imageB64: serializer.fromJson<String?>(json['imageB64']),
      ocrRawText: serializer.fromJson<String?>(json['ocrRawText']),
      status: serializer.fromJson<String>(json['status']),
      errorMsg: serializer.fromJson<String?>(json['errorMsg']),
      createdAt: serializer.fromJson<String>(json['createdAt']),
      syncedAt: serializer.fromJson<String?>(json['syncedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'barcode': serializer.toJson<String?>(barcode),
      'imageB64': serializer.toJson<String?>(imageB64),
      'ocrRawText': serializer.toJson<String?>(ocrRawText),
      'status': serializer.toJson<String>(status),
      'errorMsg': serializer.toJson<String?>(errorMsg),
      'createdAt': serializer.toJson<String>(createdAt),
      'syncedAt': serializer.toJson<String?>(syncedAt),
    };
  }

  LocalScan copyWith(
          {String? id,
          Value<String?> barcode = const Value.absent(),
          Value<String?> imageB64 = const Value.absent(),
          Value<String?> ocrRawText = const Value.absent(),
          String? status,
          Value<String?> errorMsg = const Value.absent(),
          String? createdAt,
          Value<String?> syncedAt = const Value.absent()}) =>
      LocalScan(
        id: id ?? this.id,
        barcode: barcode.present ? barcode.value : this.barcode,
        imageB64: imageB64.present ? imageB64.value : this.imageB64,
        ocrRawText: ocrRawText.present ? ocrRawText.value : this.ocrRawText,
        status: status ?? this.status,
        errorMsg: errorMsg.present ? errorMsg.value : this.errorMsg,
        createdAt: createdAt ?? this.createdAt,
        syncedAt: syncedAt.present ? syncedAt.value : this.syncedAt,
      );
  LocalScan copyWithCompanion(LocalScansCompanion data) {
    return LocalScan(
      id: data.id.present ? data.id.value : this.id,
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      imageB64: data.imageB64.present ? data.imageB64.value : this.imageB64,
      ocrRawText:
          data.ocrRawText.present ? data.ocrRawText.value : this.ocrRawText,
      status: data.status.present ? data.status.value : this.status,
      errorMsg: data.errorMsg.present ? data.errorMsg.value : this.errorMsg,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      syncedAt: data.syncedAt.present ? data.syncedAt.value : this.syncedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalScan(')
          ..write('id: $id, ')
          ..write('barcode: $barcode, ')
          ..write('imageB64: $imageB64, ')
          ..write('ocrRawText: $ocrRawText, ')
          ..write('status: $status, ')
          ..write('errorMsg: $errorMsg, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
      id, barcode, imageB64, ocrRawText, status, errorMsg, createdAt, syncedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalScan &&
          other.id == this.id &&
          other.barcode == this.barcode &&
          other.imageB64 == this.imageB64 &&
          other.ocrRawText == this.ocrRawText &&
          other.status == this.status &&
          other.errorMsg == this.errorMsg &&
          other.createdAt == this.createdAt &&
          other.syncedAt == this.syncedAt);
}

class LocalScansCompanion extends UpdateCompanion<LocalScan> {
  final Value<String> id;
  final Value<String?> barcode;
  final Value<String?> imageB64;
  final Value<String?> ocrRawText;
  final Value<String> status;
  final Value<String?> errorMsg;
  final Value<String> createdAt;
  final Value<String?> syncedAt;
  final Value<int> rowid;
  const LocalScansCompanion({
    this.id = const Value.absent(),
    this.barcode = const Value.absent(),
    this.imageB64 = const Value.absent(),
    this.ocrRawText = const Value.absent(),
    this.status = const Value.absent(),
    this.errorMsg = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalScansCompanion.insert({
    this.id = const Value.absent(),
    this.barcode = const Value.absent(),
    this.imageB64 = const Value.absent(),
    this.ocrRawText = const Value.absent(),
    this.status = const Value.absent(),
    this.errorMsg = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.syncedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  static Insertable<LocalScan> custom({
    Expression<String>? id,
    Expression<String>? barcode,
    Expression<String>? imageB64,
    Expression<String>? ocrRawText,
    Expression<String>? status,
    Expression<String>? errorMsg,
    Expression<String>? createdAt,
    Expression<String>? syncedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (barcode != null) 'barcode': barcode,
      if (imageB64 != null) 'image_b64': imageB64,
      if (ocrRawText != null) 'ocr_raw_text': ocrRawText,
      if (status != null) 'status': status,
      if (errorMsg != null) 'error_msg': errorMsg,
      if (createdAt != null) 'created_at': createdAt,
      if (syncedAt != null) 'synced_at': syncedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalScansCompanion copyWith(
      {Value<String>? id,
      Value<String?>? barcode,
      Value<String?>? imageB64,
      Value<String?>? ocrRawText,
      Value<String>? status,
      Value<String?>? errorMsg,
      Value<String>? createdAt,
      Value<String?>? syncedAt,
      Value<int>? rowid}) {
    return LocalScansCompanion(
      id: id ?? this.id,
      barcode: barcode ?? this.barcode,
      imageB64: imageB64 ?? this.imageB64,
      ocrRawText: ocrRawText ?? this.ocrRawText,
      status: status ?? this.status,
      errorMsg: errorMsg ?? this.errorMsg,
      createdAt: createdAt ?? this.createdAt,
      syncedAt: syncedAt ?? this.syncedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (imageB64.present) {
      map['image_b64'] = Variable<String>(imageB64.value);
    }
    if (ocrRawText.present) {
      map['ocr_raw_text'] = Variable<String>(ocrRawText.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (errorMsg.present) {
      map['error_msg'] = Variable<String>(errorMsg.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<String>(createdAt.value);
    }
    if (syncedAt.present) {
      map['synced_at'] = Variable<String>(syncedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalScansCompanion(')
          ..write('id: $id, ')
          ..write('barcode: $barcode, ')
          ..write('imageB64: $imageB64, ')
          ..write('ocrRawText: $ocrRawText, ')
          ..write('status: $status, ')
          ..write('errorMsg: $errorMsg, ')
          ..write('createdAt: $createdAt, ')
          ..write('syncedAt: $syncedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalProductsTable extends LocalProducts
    with TableInfo<$LocalProductsTable, LocalProduct> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalProductsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _barcodeMeta =
      const VerificationMeta('barcode');
  @override
  late final GeneratedColumn<String> barcode = GeneratedColumn<String>(
      'barcode', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
      'name', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _brandMeta = const VerificationMeta('brand');
  @override
  late final GeneratedColumn<String> brand = GeneratedColumn<String>(
      'brand', aliasedName, true,
      type: DriftSqlType.string, requiredDuringInsert: false);
  static const VerificationMeta _sourceMeta = const VerificationMeta('source');
  @override
  late final GeneratedColumn<String> source = GeneratedColumn<String>(
      'source', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _energyKcalMeta =
      const VerificationMeta('energyKcal');
  @override
  late final GeneratedColumn<double> energyKcal = GeneratedColumn<double>(
      'energy_kcal', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _proteinGMeta =
      const VerificationMeta('proteinG');
  @override
  late final GeneratedColumn<double> proteinG = GeneratedColumn<double>(
      'protein_g', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _fatTotalGMeta =
      const VerificationMeta('fatTotalG');
  @override
  late final GeneratedColumn<double> fatTotalG = GeneratedColumn<double>(
      'fat_total_g', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _carbohydratesGMeta =
      const VerificationMeta('carbohydratesG');
  @override
  late final GeneratedColumn<double> carbohydratesG = GeneratedColumn<double>(
      'carbohydrates_g', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _sodiumMgMeta =
      const VerificationMeta('sodiumMg');
  @override
  late final GeneratedColumn<double> sodiumMg = GeneratedColumn<double>(
      'sodium_mg', aliasedName, true,
      type: DriftSqlType.double, requiredDuringInsert: false);
  static const VerificationMeta _jsonPayloadMeta =
      const VerificationMeta('jsonPayload');
  @override
  late final GeneratedColumn<String> jsonPayload = GeneratedColumn<String>(
      'json_payload', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _cachedAtMeta =
      const VerificationMeta('cachedAt');
  @override
  late final GeneratedColumn<String> cachedAt = GeneratedColumn<String>(
      'cached_at', aliasedName, false,
      type: DriftSqlType.string,
      requiredDuringInsert: false,
      clientDefault: _now);
  @override
  List<GeneratedColumn> get $columns => [
        barcode,
        name,
        brand,
        source,
        energyKcal,
        proteinG,
        fatTotalG,
        carbohydratesG,
        sodiumMg,
        jsonPayload,
        cachedAt
      ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_products';
  @override
  VerificationContext validateIntegrity(Insertable<LocalProduct> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('barcode')) {
      context.handle(_barcodeMeta,
          barcode.isAcceptableOrUnknown(data['barcode']!, _barcodeMeta));
    } else if (isInserting) {
      context.missing(_barcodeMeta);
    }
    if (data.containsKey('name')) {
      context.handle(
          _nameMeta, name.isAcceptableOrUnknown(data['name']!, _nameMeta));
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('brand')) {
      context.handle(
          _brandMeta, brand.isAcceptableOrUnknown(data['brand']!, _brandMeta));
    }
    if (data.containsKey('source')) {
      context.handle(_sourceMeta,
          source.isAcceptableOrUnknown(data['source']!, _sourceMeta));
    } else if (isInserting) {
      context.missing(_sourceMeta);
    }
    if (data.containsKey('energy_kcal')) {
      context.handle(
          _energyKcalMeta,
          energyKcal.isAcceptableOrUnknown(
              data['energy_kcal']!, _energyKcalMeta));
    }
    if (data.containsKey('protein_g')) {
      context.handle(_proteinGMeta,
          proteinG.isAcceptableOrUnknown(data['protein_g']!, _proteinGMeta));
    }
    if (data.containsKey('fat_total_g')) {
      context.handle(
          _fatTotalGMeta,
          fatTotalG.isAcceptableOrUnknown(
              data['fat_total_g']!, _fatTotalGMeta));
    }
    if (data.containsKey('carbohydrates_g')) {
      context.handle(
          _carbohydratesGMeta,
          carbohydratesG.isAcceptableOrUnknown(
              data['carbohydrates_g']!, _carbohydratesGMeta));
    }
    if (data.containsKey('sodium_mg')) {
      context.handle(_sodiumMgMeta,
          sodiumMg.isAcceptableOrUnknown(data['sodium_mg']!, _sodiumMgMeta));
    }
    if (data.containsKey('json_payload')) {
      context.handle(
          _jsonPayloadMeta,
          jsonPayload.isAcceptableOrUnknown(
              data['json_payload']!, _jsonPayloadMeta));
    } else if (isInserting) {
      context.missing(_jsonPayloadMeta);
    }
    if (data.containsKey('cached_at')) {
      context.handle(_cachedAtMeta,
          cachedAt.isAcceptableOrUnknown(data['cached_at']!, _cachedAtMeta));
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {barcode};
  @override
  LocalProduct map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalProduct(
      barcode: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}barcode'])!,
      name: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}name'])!,
      brand: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}brand']),
      source: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}source'])!,
      energyKcal: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}energy_kcal']),
      proteinG: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}protein_g']),
      fatTotalG: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}fat_total_g']),
      carbohydratesG: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}carbohydrates_g']),
      sodiumMg: attachedDatabase.typeMapping
          .read(DriftSqlType.double, data['${effectivePrefix}sodium_mg']),
      jsonPayload: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}json_payload'])!,
      cachedAt: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}cached_at'])!,
    );
  }

  @override
  $LocalProductsTable createAlias(String alias) {
    return $LocalProductsTable(attachedDatabase, alias);
  }
}

class LocalProduct extends DataClass implements Insertable<LocalProduct> {
  final String barcode;
  final String name;
  final String? brand;
  final String source;
  final double? energyKcal;
  final double? proteinG;
  final double? fatTotalG;
  final double? carbohydratesG;
  final double? sodiumMg;
  final String jsonPayload;
  final String cachedAt;
  const LocalProduct(
      {required this.barcode,
      required this.name,
      this.brand,
      required this.source,
      this.energyKcal,
      this.proteinG,
      this.fatTotalG,
      this.carbohydratesG,
      this.sodiumMg,
      required this.jsonPayload,
      required this.cachedAt});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['barcode'] = Variable<String>(barcode);
    map['name'] = Variable<String>(name);
    if (!nullToAbsent || brand != null) {
      map['brand'] = Variable<String>(brand);
    }
    map['source'] = Variable<String>(source);
    if (!nullToAbsent || energyKcal != null) {
      map['energy_kcal'] = Variable<double>(energyKcal);
    }
    if (!nullToAbsent || proteinG != null) {
      map['protein_g'] = Variable<double>(proteinG);
    }
    if (!nullToAbsent || fatTotalG != null) {
      map['fat_total_g'] = Variable<double>(fatTotalG);
    }
    if (!nullToAbsent || carbohydratesG != null) {
      map['carbohydrates_g'] = Variable<double>(carbohydratesG);
    }
    if (!nullToAbsent || sodiumMg != null) {
      map['sodium_mg'] = Variable<double>(sodiumMg);
    }
    map['json_payload'] = Variable<String>(jsonPayload);
    map['cached_at'] = Variable<String>(cachedAt);
    return map;
  }

  LocalProductsCompanion toCompanion(bool nullToAbsent) {
    return LocalProductsCompanion(
      barcode: Value(barcode),
      name: Value(name),
      brand:
          brand == null && nullToAbsent ? const Value.absent() : Value(brand),
      source: Value(source),
      energyKcal: energyKcal == null && nullToAbsent
          ? const Value.absent()
          : Value(energyKcal),
      proteinG: proteinG == null && nullToAbsent
          ? const Value.absent()
          : Value(proteinG),
      fatTotalG: fatTotalG == null && nullToAbsent
          ? const Value.absent()
          : Value(fatTotalG),
      carbohydratesG: carbohydratesG == null && nullToAbsent
          ? const Value.absent()
          : Value(carbohydratesG),
      sodiumMg: sodiumMg == null && nullToAbsent
          ? const Value.absent()
          : Value(sodiumMg),
      jsonPayload: Value(jsonPayload),
      cachedAt: Value(cachedAt),
    );
  }

  factory LocalProduct.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalProduct(
      barcode: serializer.fromJson<String>(json['barcode']),
      name: serializer.fromJson<String>(json['name']),
      brand: serializer.fromJson<String?>(json['brand']),
      source: serializer.fromJson<String>(json['source']),
      energyKcal: serializer.fromJson<double?>(json['energyKcal']),
      proteinG: serializer.fromJson<double?>(json['proteinG']),
      fatTotalG: serializer.fromJson<double?>(json['fatTotalG']),
      carbohydratesG: serializer.fromJson<double?>(json['carbohydratesG']),
      sodiumMg: serializer.fromJson<double?>(json['sodiumMg']),
      jsonPayload: serializer.fromJson<String>(json['jsonPayload']),
      cachedAt: serializer.fromJson<String>(json['cachedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'barcode': serializer.toJson<String>(barcode),
      'name': serializer.toJson<String>(name),
      'brand': serializer.toJson<String?>(brand),
      'source': serializer.toJson<String>(source),
      'energyKcal': serializer.toJson<double?>(energyKcal),
      'proteinG': serializer.toJson<double?>(proteinG),
      'fatTotalG': serializer.toJson<double?>(fatTotalG),
      'carbohydratesG': serializer.toJson<double?>(carbohydratesG),
      'sodiumMg': serializer.toJson<double?>(sodiumMg),
      'jsonPayload': serializer.toJson<String>(jsonPayload),
      'cachedAt': serializer.toJson<String>(cachedAt),
    };
  }

  LocalProduct copyWith(
          {String? barcode,
          String? name,
          Value<String?> brand = const Value.absent(),
          String? source,
          Value<double?> energyKcal = const Value.absent(),
          Value<double?> proteinG = const Value.absent(),
          Value<double?> fatTotalG = const Value.absent(),
          Value<double?> carbohydratesG = const Value.absent(),
          Value<double?> sodiumMg = const Value.absent(),
          String? jsonPayload,
          String? cachedAt}) =>
      LocalProduct(
        barcode: barcode ?? this.barcode,
        name: name ?? this.name,
        brand: brand.present ? brand.value : this.brand,
        source: source ?? this.source,
        energyKcal: energyKcal.present ? energyKcal.value : this.energyKcal,
        proteinG: proteinG.present ? proteinG.value : this.proteinG,
        fatTotalG: fatTotalG.present ? fatTotalG.value : this.fatTotalG,
        carbohydratesG:
            carbohydratesG.present ? carbohydratesG.value : this.carbohydratesG,
        sodiumMg: sodiumMg.present ? sodiumMg.value : this.sodiumMg,
        jsonPayload: jsonPayload ?? this.jsonPayload,
        cachedAt: cachedAt ?? this.cachedAt,
      );
  LocalProduct copyWithCompanion(LocalProductsCompanion data) {
    return LocalProduct(
      barcode: data.barcode.present ? data.barcode.value : this.barcode,
      name: data.name.present ? data.name.value : this.name,
      brand: data.brand.present ? data.brand.value : this.brand,
      source: data.source.present ? data.source.value : this.source,
      energyKcal:
          data.energyKcal.present ? data.energyKcal.value : this.energyKcal,
      proteinG: data.proteinG.present ? data.proteinG.value : this.proteinG,
      fatTotalG: data.fatTotalG.present ? data.fatTotalG.value : this.fatTotalG,
      carbohydratesG: data.carbohydratesG.present
          ? data.carbohydratesG.value
          : this.carbohydratesG,
      sodiumMg: data.sodiumMg.present ? data.sodiumMg.value : this.sodiumMg,
      jsonPayload:
          data.jsonPayload.present ? data.jsonPayload.value : this.jsonPayload,
      cachedAt: data.cachedAt.present ? data.cachedAt.value : this.cachedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalProduct(')
          ..write('barcode: $barcode, ')
          ..write('name: $name, ')
          ..write('brand: $brand, ')
          ..write('source: $source, ')
          ..write('energyKcal: $energyKcal, ')
          ..write('proteinG: $proteinG, ')
          ..write('fatTotalG: $fatTotalG, ')
          ..write('carbohydratesG: $carbohydratesG, ')
          ..write('sodiumMg: $sodiumMg, ')
          ..write('jsonPayload: $jsonPayload, ')
          ..write('cachedAt: $cachedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(barcode, name, brand, source, energyKcal,
      proteinG, fatTotalG, carbohydratesG, sodiumMg, jsonPayload, cachedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalProduct &&
          other.barcode == this.barcode &&
          other.name == this.name &&
          other.brand == this.brand &&
          other.source == this.source &&
          other.energyKcal == this.energyKcal &&
          other.proteinG == this.proteinG &&
          other.fatTotalG == this.fatTotalG &&
          other.carbohydratesG == this.carbohydratesG &&
          other.sodiumMg == this.sodiumMg &&
          other.jsonPayload == this.jsonPayload &&
          other.cachedAt == this.cachedAt);
}

class LocalProductsCompanion extends UpdateCompanion<LocalProduct> {
  final Value<String> barcode;
  final Value<String> name;
  final Value<String?> brand;
  final Value<String> source;
  final Value<double?> energyKcal;
  final Value<double?> proteinG;
  final Value<double?> fatTotalG;
  final Value<double?> carbohydratesG;
  final Value<double?> sodiumMg;
  final Value<String> jsonPayload;
  final Value<String> cachedAt;
  final Value<int> rowid;
  const LocalProductsCompanion({
    this.barcode = const Value.absent(),
    this.name = const Value.absent(),
    this.brand = const Value.absent(),
    this.source = const Value.absent(),
    this.energyKcal = const Value.absent(),
    this.proteinG = const Value.absent(),
    this.fatTotalG = const Value.absent(),
    this.carbohydratesG = const Value.absent(),
    this.sodiumMg = const Value.absent(),
    this.jsonPayload = const Value.absent(),
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalProductsCompanion.insert({
    required String barcode,
    required String name,
    this.brand = const Value.absent(),
    required String source,
    this.energyKcal = const Value.absent(),
    this.proteinG = const Value.absent(),
    this.fatTotalG = const Value.absent(),
    this.carbohydratesG = const Value.absent(),
    this.sodiumMg = const Value.absent(),
    required String jsonPayload,
    this.cachedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  })  : barcode = Value(barcode),
        name = Value(name),
        source = Value(source),
        jsonPayload = Value(jsonPayload);
  static Insertable<LocalProduct> custom({
    Expression<String>? barcode,
    Expression<String>? name,
    Expression<String>? brand,
    Expression<String>? source,
    Expression<double>? energyKcal,
    Expression<double>? proteinG,
    Expression<double>? fatTotalG,
    Expression<double>? carbohydratesG,
    Expression<double>? sodiumMg,
    Expression<String>? jsonPayload,
    Expression<String>? cachedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (barcode != null) 'barcode': barcode,
      if (name != null) 'name': name,
      if (brand != null) 'brand': brand,
      if (source != null) 'source': source,
      if (energyKcal != null) 'energy_kcal': energyKcal,
      if (proteinG != null) 'protein_g': proteinG,
      if (fatTotalG != null) 'fat_total_g': fatTotalG,
      if (carbohydratesG != null) 'carbohydrates_g': carbohydratesG,
      if (sodiumMg != null) 'sodium_mg': sodiumMg,
      if (jsonPayload != null) 'json_payload': jsonPayload,
      if (cachedAt != null) 'cached_at': cachedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalProductsCompanion copyWith(
      {Value<String>? barcode,
      Value<String>? name,
      Value<String?>? brand,
      Value<String>? source,
      Value<double?>? energyKcal,
      Value<double?>? proteinG,
      Value<double?>? fatTotalG,
      Value<double?>? carbohydratesG,
      Value<double?>? sodiumMg,
      Value<String>? jsonPayload,
      Value<String>? cachedAt,
      Value<int>? rowid}) {
    return LocalProductsCompanion(
      barcode: barcode ?? this.barcode,
      name: name ?? this.name,
      brand: brand ?? this.brand,
      source: source ?? this.source,
      energyKcal: energyKcal ?? this.energyKcal,
      proteinG: proteinG ?? this.proteinG,
      fatTotalG: fatTotalG ?? this.fatTotalG,
      carbohydratesG: carbohydratesG ?? this.carbohydratesG,
      sodiumMg: sodiumMg ?? this.sodiumMg,
      jsonPayload: jsonPayload ?? this.jsonPayload,
      cachedAt: cachedAt ?? this.cachedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (barcode.present) {
      map['barcode'] = Variable<String>(barcode.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (brand.present) {
      map['brand'] = Variable<String>(brand.value);
    }
    if (source.present) {
      map['source'] = Variable<String>(source.value);
    }
    if (energyKcal.present) {
      map['energy_kcal'] = Variable<double>(energyKcal.value);
    }
    if (proteinG.present) {
      map['protein_g'] = Variable<double>(proteinG.value);
    }
    if (fatTotalG.present) {
      map['fat_total_g'] = Variable<double>(fatTotalG.value);
    }
    if (carbohydratesG.present) {
      map['carbohydrates_g'] = Variable<double>(carbohydratesG.value);
    }
    if (sodiumMg.present) {
      map['sodium_mg'] = Variable<double>(sodiumMg.value);
    }
    if (jsonPayload.present) {
      map['json_payload'] = Variable<String>(jsonPayload.value);
    }
    if (cachedAt.present) {
      map['cached_at'] = Variable<String>(cachedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalProductsCompanion(')
          ..write('barcode: $barcode, ')
          ..write('name: $name, ')
          ..write('brand: $brand, ')
          ..write('source: $source, ')
          ..write('energyKcal: $energyKcal, ')
          ..write('proteinG: $proteinG, ')
          ..write('fatTotalG: $fatTotalG, ')
          ..write('carbohydratesG: $carbohydratesG, ')
          ..write('sodiumMg: $sodiumMg, ')
          ..write('jsonPayload: $jsonPayload, ')
          ..write('cachedAt: $cachedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $OnboardingFlagsTable extends OnboardingFlags
    with TableInfo<$OnboardingFlagsTable, OnboardingFlag> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $OnboardingFlagsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _keyMeta = const VerificationMeta('key');
  @override
  late final GeneratedColumn<String> key = GeneratedColumn<String>(
      'key', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  static const VerificationMeta _valueMeta = const VerificationMeta('value');
  @override
  late final GeneratedColumn<String> value = GeneratedColumn<String>(
      'value', aliasedName, false,
      type: DriftSqlType.string, requiredDuringInsert: true);
  @override
  List<GeneratedColumn> get $columns => [key, value];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'onboarding_flags';
  @override
  VerificationContext validateIntegrity(Insertable<OnboardingFlag> instance,
      {bool isInserting = false}) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('key')) {
      context.handle(
          _keyMeta, key.isAcceptableOrUnknown(data['key']!, _keyMeta));
    } else if (isInserting) {
      context.missing(_keyMeta);
    }
    if (data.containsKey('value')) {
      context.handle(
          _valueMeta, value.isAcceptableOrUnknown(data['value']!, _valueMeta));
    } else if (isInserting) {
      context.missing(_valueMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {key};
  @override
  OnboardingFlag map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return OnboardingFlag(
      key: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}key'])!,
      value: attachedDatabase.typeMapping
          .read(DriftSqlType.string, data['${effectivePrefix}value'])!,
    );
  }

  @override
  $OnboardingFlagsTable createAlias(String alias) {
    return $OnboardingFlagsTable(attachedDatabase, alias);
  }
}

class OnboardingFlag extends DataClass implements Insertable<OnboardingFlag> {
  final String key;
  final String value;
  const OnboardingFlag({required this.key, required this.value});
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['key'] = Variable<String>(key);
    map['value'] = Variable<String>(value);
    return map;
  }

  OnboardingFlagsCompanion toCompanion(bool nullToAbsent) {
    return OnboardingFlagsCompanion(
      key: Value(key),
      value: Value(value),
    );
  }

  factory OnboardingFlag.fromJson(Map<String, dynamic> json,
      {ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return OnboardingFlag(
      key: serializer.fromJson<String>(json['key']),
      value: serializer.fromJson<String>(json['value']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'key': serializer.toJson<String>(key),
      'value': serializer.toJson<String>(value),
    };
  }

  OnboardingFlag copyWith({String? key, String? value}) => OnboardingFlag(
        key: key ?? this.key,
        value: value ?? this.value,
      );
  OnboardingFlag copyWithCompanion(OnboardingFlagsCompanion data) {
    return OnboardingFlag(
      key: data.key.present ? data.key.value : this.key,
      value: data.value.present ? data.value.value : this.value,
    );
  }

  @override
  String toString() {
    return (StringBuffer('OnboardingFlag(')
          ..write('key: $key, ')
          ..write('value: $value')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(key, value);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OnboardingFlag &&
          other.key == this.key &&
          other.value == this.value);
}

class OnboardingFlagsCompanion extends UpdateCompanion<OnboardingFlag> {
  final Value<String> key;
  final Value<String> value;
  final Value<int> rowid;
  const OnboardingFlagsCompanion({
    this.key = const Value.absent(),
    this.value = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  OnboardingFlagsCompanion.insert({
    required String key,
    required String value,
    this.rowid = const Value.absent(),
  })  : key = Value(key),
        value = Value(value);
  static Insertable<OnboardingFlag> custom({
    Expression<String>? key,
    Expression<String>? value,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (key != null) 'key': key,
      if (value != null) 'value': value,
      if (rowid != null) 'rowid': rowid,
    });
  }

  OnboardingFlagsCompanion copyWith(
      {Value<String>? key, Value<String>? value, Value<int>? rowid}) {
    return OnboardingFlagsCompanion(
      key: key ?? this.key,
      value: value ?? this.value,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (key.present) {
      map['key'] = Variable<String>(key.value);
    }
    if (value.present) {
      map['value'] = Variable<String>(value.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('OnboardingFlagsCompanion(')
          ..write('key: $key, ')
          ..write('value: $value, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$AppDatabase extends GeneratedDatabase {
  _$AppDatabase(QueryExecutor e) : super(e);
  $AppDatabaseManager get managers => $AppDatabaseManager(this);
  late final $LocalScansTable localScans = $LocalScansTable(this);
  late final $LocalProductsTable localProducts = $LocalProductsTable(this);
  late final $OnboardingFlagsTable onboardingFlags =
      $OnboardingFlagsTable(this);
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities =>
      [localScans, localProducts, onboardingFlags];
}

typedef $$LocalScansTableCreateCompanionBuilder = LocalScansCompanion Function({
  Value<String> id,
  Value<String?> barcode,
  Value<String?> imageB64,
  Value<String?> ocrRawText,
  Value<String> status,
  Value<String?> errorMsg,
  Value<String> createdAt,
  Value<String?> syncedAt,
  Value<int> rowid,
});
typedef $$LocalScansTableUpdateCompanionBuilder = LocalScansCompanion Function({
  Value<String> id,
  Value<String?> barcode,
  Value<String?> imageB64,
  Value<String?> ocrRawText,
  Value<String> status,
  Value<String?> errorMsg,
  Value<String> createdAt,
  Value<String?> syncedAt,
  Value<int> rowid,
});

class $$LocalScansTableFilterComposer
    extends Composer<_$AppDatabase, $LocalScansTable> {
  $$LocalScansTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get barcode => $composableBuilder(
      column: $table.barcode, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get imageB64 => $composableBuilder(
      column: $table.imageB64, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get ocrRawText => $composableBuilder(
      column: $table.ocrRawText, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get errorMsg => $composableBuilder(
      column: $table.errorMsg, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnFilters(column));
}

class $$LocalScansTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalScansTable> {
  $$LocalScansTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
      column: $table.id, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get barcode => $composableBuilder(
      column: $table.barcode, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get imageB64 => $composableBuilder(
      column: $table.imageB64, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get ocrRawText => $composableBuilder(
      column: $table.ocrRawText, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get status => $composableBuilder(
      column: $table.status, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get errorMsg => $composableBuilder(
      column: $table.errorMsg, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get createdAt => $composableBuilder(
      column: $table.createdAt, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get syncedAt => $composableBuilder(
      column: $table.syncedAt, builder: (column) => ColumnOrderings(column));
}

class $$LocalScansTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalScansTable> {
  $$LocalScansTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<String> get imageB64 =>
      $composableBuilder(column: $table.imageB64, builder: (column) => column);

  GeneratedColumn<String> get ocrRawText => $composableBuilder(
      column: $table.ocrRawText, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<String> get errorMsg =>
      $composableBuilder(column: $table.errorMsg, builder: (column) => column);

  GeneratedColumn<String> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<String> get syncedAt =>
      $composableBuilder(column: $table.syncedAt, builder: (column) => column);
}

class $$LocalScansTableTableManager extends RootTableManager<
    _$AppDatabase,
    $LocalScansTable,
    LocalScan,
    $$LocalScansTableFilterComposer,
    $$LocalScansTableOrderingComposer,
    $$LocalScansTableAnnotationComposer,
    $$LocalScansTableCreateCompanionBuilder,
    $$LocalScansTableUpdateCompanionBuilder,
    (LocalScan, BaseReferences<_$AppDatabase, $LocalScansTable, LocalScan>),
    LocalScan,
    PrefetchHooks Function()> {
  $$LocalScansTableTableManager(_$AppDatabase db, $LocalScansTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalScansTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalScansTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalScansTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String?> barcode = const Value.absent(),
            Value<String?> imageB64 = const Value.absent(),
            Value<String?> ocrRawText = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String?> errorMsg = const Value.absent(),
            Value<String> createdAt = const Value.absent(),
            Value<String?> syncedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              LocalScansCompanion(
            id: id,
            barcode: barcode,
            imageB64: imageB64,
            ocrRawText: ocrRawText,
            status: status,
            errorMsg: errorMsg,
            createdAt: createdAt,
            syncedAt: syncedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            Value<String> id = const Value.absent(),
            Value<String?> barcode = const Value.absent(),
            Value<String?> imageB64 = const Value.absent(),
            Value<String?> ocrRawText = const Value.absent(),
            Value<String> status = const Value.absent(),
            Value<String?> errorMsg = const Value.absent(),
            Value<String> createdAt = const Value.absent(),
            Value<String?> syncedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              LocalScansCompanion.insert(
            id: id,
            barcode: barcode,
            imageB64: imageB64,
            ocrRawText: ocrRawText,
            status: status,
            errorMsg: errorMsg,
            createdAt: createdAt,
            syncedAt: syncedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$LocalScansTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $LocalScansTable,
    LocalScan,
    $$LocalScansTableFilterComposer,
    $$LocalScansTableOrderingComposer,
    $$LocalScansTableAnnotationComposer,
    $$LocalScansTableCreateCompanionBuilder,
    $$LocalScansTableUpdateCompanionBuilder,
    (LocalScan, BaseReferences<_$AppDatabase, $LocalScansTable, LocalScan>),
    LocalScan,
    PrefetchHooks Function()>;
typedef $$LocalProductsTableCreateCompanionBuilder = LocalProductsCompanion
    Function({
  required String barcode,
  required String name,
  Value<String?> brand,
  required String source,
  Value<double?> energyKcal,
  Value<double?> proteinG,
  Value<double?> fatTotalG,
  Value<double?> carbohydratesG,
  Value<double?> sodiumMg,
  required String jsonPayload,
  Value<String> cachedAt,
  Value<int> rowid,
});
typedef $$LocalProductsTableUpdateCompanionBuilder = LocalProductsCompanion
    Function({
  Value<String> barcode,
  Value<String> name,
  Value<String?> brand,
  Value<String> source,
  Value<double?> energyKcal,
  Value<double?> proteinG,
  Value<double?> fatTotalG,
  Value<double?> carbohydratesG,
  Value<double?> sodiumMg,
  Value<String> jsonPayload,
  Value<String> cachedAt,
  Value<int> rowid,
});

class $$LocalProductsTableFilterComposer
    extends Composer<_$AppDatabase, $LocalProductsTable> {
  $$LocalProductsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get barcode => $composableBuilder(
      column: $table.barcode, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get brand => $composableBuilder(
      column: $table.brand, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get source => $composableBuilder(
      column: $table.source, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get energyKcal => $composableBuilder(
      column: $table.energyKcal, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get proteinG => $composableBuilder(
      column: $table.proteinG, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get fatTotalG => $composableBuilder(
      column: $table.fatTotalG, builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get carbohydratesG => $composableBuilder(
      column: $table.carbohydratesG,
      builder: (column) => ColumnFilters(column));

  ColumnFilters<double> get sodiumMg => $composableBuilder(
      column: $table.sodiumMg, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get jsonPayload => $composableBuilder(
      column: $table.jsonPayload, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnFilters(column));
}

class $$LocalProductsTableOrderingComposer
    extends Composer<_$AppDatabase, $LocalProductsTable> {
  $$LocalProductsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get barcode => $composableBuilder(
      column: $table.barcode, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get name => $composableBuilder(
      column: $table.name, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get brand => $composableBuilder(
      column: $table.brand, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get source => $composableBuilder(
      column: $table.source, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get energyKcal => $composableBuilder(
      column: $table.energyKcal, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get proteinG => $composableBuilder(
      column: $table.proteinG, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get fatTotalG => $composableBuilder(
      column: $table.fatTotalG, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get carbohydratesG => $composableBuilder(
      column: $table.carbohydratesG,
      builder: (column) => ColumnOrderings(column));

  ColumnOrderings<double> get sodiumMg => $composableBuilder(
      column: $table.sodiumMg, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get jsonPayload => $composableBuilder(
      column: $table.jsonPayload, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get cachedAt => $composableBuilder(
      column: $table.cachedAt, builder: (column) => ColumnOrderings(column));
}

class $$LocalProductsTableAnnotationComposer
    extends Composer<_$AppDatabase, $LocalProductsTable> {
  $$LocalProductsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get barcode =>
      $composableBuilder(column: $table.barcode, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get brand =>
      $composableBuilder(column: $table.brand, builder: (column) => column);

  GeneratedColumn<String> get source =>
      $composableBuilder(column: $table.source, builder: (column) => column);

  GeneratedColumn<double> get energyKcal => $composableBuilder(
      column: $table.energyKcal, builder: (column) => column);

  GeneratedColumn<double> get proteinG =>
      $composableBuilder(column: $table.proteinG, builder: (column) => column);

  GeneratedColumn<double> get fatTotalG =>
      $composableBuilder(column: $table.fatTotalG, builder: (column) => column);

  GeneratedColumn<double> get carbohydratesG => $composableBuilder(
      column: $table.carbohydratesG, builder: (column) => column);

  GeneratedColumn<double> get sodiumMg =>
      $composableBuilder(column: $table.sodiumMg, builder: (column) => column);

  GeneratedColumn<String> get jsonPayload => $composableBuilder(
      column: $table.jsonPayload, builder: (column) => column);

  GeneratedColumn<String> get cachedAt =>
      $composableBuilder(column: $table.cachedAt, builder: (column) => column);
}

class $$LocalProductsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $LocalProductsTable,
    LocalProduct,
    $$LocalProductsTableFilterComposer,
    $$LocalProductsTableOrderingComposer,
    $$LocalProductsTableAnnotationComposer,
    $$LocalProductsTableCreateCompanionBuilder,
    $$LocalProductsTableUpdateCompanionBuilder,
    (
      LocalProduct,
      BaseReferences<_$AppDatabase, $LocalProductsTable, LocalProduct>
    ),
    LocalProduct,
    PrefetchHooks Function()> {
  $$LocalProductsTableTableManager(_$AppDatabase db, $LocalProductsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalProductsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalProductsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalProductsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> barcode = const Value.absent(),
            Value<String> name = const Value.absent(),
            Value<String?> brand = const Value.absent(),
            Value<String> source = const Value.absent(),
            Value<double?> energyKcal = const Value.absent(),
            Value<double?> proteinG = const Value.absent(),
            Value<double?> fatTotalG = const Value.absent(),
            Value<double?> carbohydratesG = const Value.absent(),
            Value<double?> sodiumMg = const Value.absent(),
            Value<String> jsonPayload = const Value.absent(),
            Value<String> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              LocalProductsCompanion(
            barcode: barcode,
            name: name,
            brand: brand,
            source: source,
            energyKcal: energyKcal,
            proteinG: proteinG,
            fatTotalG: fatTotalG,
            carbohydratesG: carbohydratesG,
            sodiumMg: sodiumMg,
            jsonPayload: jsonPayload,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String barcode,
            required String name,
            Value<String?> brand = const Value.absent(),
            required String source,
            Value<double?> energyKcal = const Value.absent(),
            Value<double?> proteinG = const Value.absent(),
            Value<double?> fatTotalG = const Value.absent(),
            Value<double?> carbohydratesG = const Value.absent(),
            Value<double?> sodiumMg = const Value.absent(),
            required String jsonPayload,
            Value<String> cachedAt = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              LocalProductsCompanion.insert(
            barcode: barcode,
            name: name,
            brand: brand,
            source: source,
            energyKcal: energyKcal,
            proteinG: proteinG,
            fatTotalG: fatTotalG,
            carbohydratesG: carbohydratesG,
            sodiumMg: sodiumMg,
            jsonPayload: jsonPayload,
            cachedAt: cachedAt,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$LocalProductsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $LocalProductsTable,
    LocalProduct,
    $$LocalProductsTableFilterComposer,
    $$LocalProductsTableOrderingComposer,
    $$LocalProductsTableAnnotationComposer,
    $$LocalProductsTableCreateCompanionBuilder,
    $$LocalProductsTableUpdateCompanionBuilder,
    (
      LocalProduct,
      BaseReferences<_$AppDatabase, $LocalProductsTable, LocalProduct>
    ),
    LocalProduct,
    PrefetchHooks Function()>;
typedef $$OnboardingFlagsTableCreateCompanionBuilder = OnboardingFlagsCompanion
    Function({
  required String key,
  required String value,
  Value<int> rowid,
});
typedef $$OnboardingFlagsTableUpdateCompanionBuilder = OnboardingFlagsCompanion
    Function({
  Value<String> key,
  Value<String> value,
  Value<int> rowid,
});

class $$OnboardingFlagsTableFilterComposer
    extends Composer<_$AppDatabase, $OnboardingFlagsTable> {
  $$OnboardingFlagsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get key => $composableBuilder(
      column: $table.key, builder: (column) => ColumnFilters(column));

  ColumnFilters<String> get value => $composableBuilder(
      column: $table.value, builder: (column) => ColumnFilters(column));
}

class $$OnboardingFlagsTableOrderingComposer
    extends Composer<_$AppDatabase, $OnboardingFlagsTable> {
  $$OnboardingFlagsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get key => $composableBuilder(
      column: $table.key, builder: (column) => ColumnOrderings(column));

  ColumnOrderings<String> get value => $composableBuilder(
      column: $table.value, builder: (column) => ColumnOrderings(column));
}

class $$OnboardingFlagsTableAnnotationComposer
    extends Composer<_$AppDatabase, $OnboardingFlagsTable> {
  $$OnboardingFlagsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get key =>
      $composableBuilder(column: $table.key, builder: (column) => column);

  GeneratedColumn<String> get value =>
      $composableBuilder(column: $table.value, builder: (column) => column);
}

class $$OnboardingFlagsTableTableManager extends RootTableManager<
    _$AppDatabase,
    $OnboardingFlagsTable,
    OnboardingFlag,
    $$OnboardingFlagsTableFilterComposer,
    $$OnboardingFlagsTableOrderingComposer,
    $$OnboardingFlagsTableAnnotationComposer,
    $$OnboardingFlagsTableCreateCompanionBuilder,
    $$OnboardingFlagsTableUpdateCompanionBuilder,
    (
      OnboardingFlag,
      BaseReferences<_$AppDatabase, $OnboardingFlagsTable, OnboardingFlag>
    ),
    OnboardingFlag,
    PrefetchHooks Function()> {
  $$OnboardingFlagsTableTableManager(
      _$AppDatabase db, $OnboardingFlagsTable table)
      : super(TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$OnboardingFlagsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$OnboardingFlagsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$OnboardingFlagsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback: ({
            Value<String> key = const Value.absent(),
            Value<String> value = const Value.absent(),
            Value<int> rowid = const Value.absent(),
          }) =>
              OnboardingFlagsCompanion(
            key: key,
            value: value,
            rowid: rowid,
          ),
          createCompanionCallback: ({
            required String key,
            required String value,
            Value<int> rowid = const Value.absent(),
          }) =>
              OnboardingFlagsCompanion.insert(
            key: key,
            value: value,
            rowid: rowid,
          ),
          withReferenceMapper: (p0) => p0
              .map((e) => (e.readTable(table), BaseReferences(db, table, e)))
              .toList(),
          prefetchHooksCallback: null,
        ));
}

typedef $$OnboardingFlagsTableProcessedTableManager = ProcessedTableManager<
    _$AppDatabase,
    $OnboardingFlagsTable,
    OnboardingFlag,
    $$OnboardingFlagsTableFilterComposer,
    $$OnboardingFlagsTableOrderingComposer,
    $$OnboardingFlagsTableAnnotationComposer,
    $$OnboardingFlagsTableCreateCompanionBuilder,
    $$OnboardingFlagsTableUpdateCompanionBuilder,
    (
      OnboardingFlag,
      BaseReferences<_$AppDatabase, $OnboardingFlagsTable, OnboardingFlag>
    ),
    OnboardingFlag,
    PrefetchHooks Function()>;

class $AppDatabaseManager {
  final _$AppDatabase _db;
  $AppDatabaseManager(this._db);
  $$LocalScansTableTableManager get localScans =>
      $$LocalScansTableTableManager(_db, _db.localScans);
  $$LocalProductsTableTableManager get localProducts =>
      $$LocalProductsTableTableManager(_db, _db.localProducts);
  $$OnboardingFlagsTableTableManager get onboardingFlags =>
      $$OnboardingFlagsTableTableManager(_db, _db.onboardingFlags);
}

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$localDbHash() => r'10ee0ce2bf3f90fefc14c984830d3c662bccf8d3';

/// See also [localDb].
@ProviderFor(localDb)
final localDbProvider = Provider<AppDatabase>.internal(
  localDb,
  name: r'localDbProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$localDbHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef LocalDbRef = ProviderRef<AppDatabase>;
String _$onboardingStateHash() => r'bac095b5decc7358434523c4109e69dff54f4b92';

/// See also [onboardingState].
@ProviderFor(onboardingState)
final onboardingStateProvider =
    AutoDisposeFutureProvider<OnboardingState>.internal(
  onboardingState,
  name: r'onboardingStateProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$onboardingStateHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef OnboardingStateRef = AutoDisposeFutureProviderRef<OnboardingState>;
String _$recentScannedProductsHash() =>
    r'65511d29b9f881c468effbe2bfa0cee4b9bd7650';

/// See also [recentScannedProducts].
@ProviderFor(recentScannedProducts)
final recentScannedProductsProvider =
    AutoDisposeFutureProvider<List<LocalProduct>>.internal(
  recentScannedProducts,
  name: r'recentScannedProductsProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$recentScannedProductsHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef RecentScannedProductsRef
    = AutoDisposeFutureProviderRef<List<LocalProduct>>;
String _$scansTodayHash() => r'e2a4a75d6442a45682937e7ec131d59aa9066a72';

/// See also [scansToday].
@ProviderFor(scansToday)
final scansTodayProvider = AutoDisposeFutureProvider<int>.internal(
  scansToday,
  name: r'scansTodayProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$scansTodayHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ScansTodayRef = AutoDisposeFutureProviderRef<int>;
String _$appIntroSeenHash() => r'5c3339f39ec2bcaae752f3c69f5825e9d771b8e5';

/// See also [appIntroSeen].
@ProviderFor(appIntroSeen)
final appIntroSeenProvider = AutoDisposeFutureProvider<bool>.internal(
  appIntroSeen,
  name: r'appIntroSeenProvider',
  debugGetCreateSourceHash:
      const bool.fromEnvironment('dart.vm.product') ? null : _$appIntroSeenHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AppIntroSeenRef = AutoDisposeFutureProviderRef<bool>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
