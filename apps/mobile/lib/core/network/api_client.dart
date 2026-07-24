import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'sse_event.dart';

part 'api_client.g.dart';

// Build-time injected via --dart-define (never hardcoded).
const _apiBase = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');

@riverpod
ApiClient apiClient(Ref ref) => ApiClient._();

class ApiClient {
  ApiClient._() {
    _dio = Dio(
      BaseOptions(
        baseUrl: _apiBase,
        connectTimeout: const Duration(seconds: 15), // design-governance:ignore: network timeout, not an animation
        receiveTimeout: const Duration(seconds: 30), // design-governance:ignore: network timeout, not an animation
        headers: {HttpHeaders.contentTypeHeader: ContentType.json.mimeType},
      ),
    );
    _dio.interceptors.add(_AuthInterceptor());
    _dio.interceptors.add(_RetryInterceptor(_dio));
  }

  late final Dio _dio;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? params}) =>
      _dio.get<T>(path, queryParameters: params);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post<T>(path, data: data);

  Future<Response<T>> patch<T>(String path, {dynamic data}) =>
      _dio.patch<T>(path, data: data);

  Future<Response<T>> delete<T>(String path) =>
      _dio.delete<T>(path);

  /// Real Server-Sent-Events consumption — used by the Phase 13 multi-agent chat endpoint
  /// (`POST /v1/agent/chat`). Reads the response as a raw byte stream (not Dio's default
  /// buffer-then-parse-JSON path) and yields one [SseEvent] per real `event:`/`data:` frame as it
  /// arrives — genuine incremental delivery, not a buffered response split up afterwards.
  Stream<SseEvent> postSse(String path, {dynamic data}) {
    final controller = StreamController<SseEvent>();

    _dio.post<ResponseBody>(
      path,
      data: data,
      options: Options(responseType: ResponseType.stream),
    ).then((resp) async {
      var buffer = '';
      try {
        await for (final chunk in resp.data!.stream) {
          buffer += utf8.decode(chunk, allowMalformed: true);
          var separatorIndex = buffer.indexOf('\n\n');
          while (separatorIndex != -1) {
            final frame = buffer.substring(0, separatorIndex);
            buffer = buffer.substring(separatorIndex + 2);
            final event = SseEvent.parse(frame);
            if (event != null) controller.add(event);
            separatorIndex = buffer.indexOf('\n\n');
          }
        }
        await controller.close();
      } catch (e, st) {
        controller.addError(e, st);
        await controller.close();
      }
    }).catchError((Object e, StackTrace st) {
      controller.addError(e, st);
      controller.close();
    });

    return controller.stream;
  }
}

// Attaches Supabase JWT to every request.
class _AuthInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final session = Supabase.instance.client.auth.currentSession;
    if (session != null) {
      options.headers['Authorization'] = 'Bearer ${session.accessToken}';
    }
    handler.next(options);
  }
}

// Retries once on network errors (not on 4xx/5xx).
class _RetryInterceptor extends Interceptor {
  _RetryInterceptor(this._dio);
  final Dio _dio;

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.type == DioExceptionType.connectionError ||
        err.type == DioExceptionType.connectionTimeout) {
      try {
        final resp = await _dio.fetch<dynamic>(err.requestOptions);
        handler.resolve(resp);
        return;
      } catch (_) {}
    }
    handler.next(err);
  }
}
