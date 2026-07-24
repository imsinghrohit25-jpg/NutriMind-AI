import '../../core/design_system/components/app_loader.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/design_system/app_palette.dart';
import '../../core/design_system/tokens.dart';
import '../../core/network/api_client.dart';

/// Health Copilot streaming chat screen.
/// Sends POST /v1/copilot with SSE streaming, renders incremental text.
/// Tappable citation chips expand to show source details.
/// Disclaimer surface is always visible above the input bar.

class CopilotScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic>? productContext;  // injected when launched from product screen

  const CopilotScreen({super.key, this.productContext});

  @override
  ConsumerState<CopilotScreen> createState() => _CopilotScreenState();
}

class _CopilotScreenState extends ConsumerState<CopilotScreen> {
  final _controller  = TextEditingController();
  final _scrollCtrl  = ScrollController();
  final List<_Message> _messages = [];
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final query = _controller.text.trim();
    if (query.isEmpty || _loading) return;

    setState(() {
      _messages.add(_Message(role: 'user', text: query));
      _loading = true;
    });
    _controller.clear();
    _scrollToBottom();

    try {
      final client = ref.read(apiClientProvider);

      // POST with SSE – basic implementation collects full response
      final response = await client.post<Map<String, dynamic>>(
        '/v1/copilot',
        data: {
          'query': query,
          if (widget.productContext != null) 'productContext': widget.productContext,
        },
      );

      final data = response.data ?? {};
      if (data['type'] == 'refusal') {
        setState(() {
          _messages.add(_Message(
            role: 'refusal',
            text: data['message'] as String? ?? 'This question is outside what I can help with.',
            redirectNote: data['redirectNote'] as String?,
          ));
        });
      } else {
        // For streaming, the full text arrives via SSE; here we read the compiled response
        final text = data['text'] as String? ?? '';
        final citations = (data['citations'] as List<dynamic>?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ?? [];
        setState(() {
          _messages.add(_Message(role: 'assistant', text: text, citations: citations));
        });
      }
    } catch (e) {
      setState(() {
        _messages.add(const _Message(
          role: 'error',
          text: 'Could not reach the Copilot. Please check your connection.',
        ));
      });
    } finally {
      setState(() => _loading = false);
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: AppMotion.standard,
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Health Copilot'),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline),
            tooltip: 'About Copilot',
            onPressed: () => _showAboutDialog(context),
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.productContext != null)
            _ProductContextBanner(context: widget.productContext!),
          Expanded(
            child: _messages.isEmpty
                ? const _EmptyState()
                : ListView.builder(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(AppSpacing.m),
                    itemCount: _messages.length,
                    itemBuilder: (_, i) => _MessageBubble(message: _messages[i]),
                  ),
          ),
          const _DisclaimerBar(),
          _InputBar(
            controller: _controller,
            loading: _loading,
            onSend: _send,
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext ctx) {
    showDialog<void>(
      context: ctx,
      builder: (_) => AlertDialog(
        title: const Text('About Health Copilot'),
        content: const Text(
          'NutriMind Health Copilot is a RAG-powered food literacy assistant. '
          'It retrieves information from WHO, ICMR-NIN, FSSAI, and RSSDI-ESI guidelines '
          'and generates cited answers to nutrition questions.\n\n'
          'The Copilot cannot diagnose medical conditions, recommend medications, '
          'or make treatment decisions. For medical advice, consult a registered doctor or dietitian.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK')),
        ],
      ),
    );
  }
}

// ── Models ───────────────────────────────────────────────────────────────────────

class _Message {
  final String role;   // 'user' | 'assistant' | 'refusal' | 'error'
  final String text;
  final List<Map<String, dynamic>> citations;
  final String? redirectNote;

  const _Message({
    required this.role,
    required this.text,
    this.citations = const [],
    this.redirectNote,
  });
}

// ── Message bubble ───────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  final _Message message;
  const _MessageBubble({required this.message});

  @override
  Widget build(BuildContext context) {
    final isUser = message.role == 'user';

    return Padding(
      padding: EdgeInsets.only(
        top: AppSpacing.s,
        left: isUser ? AppSpacing.xxxl : 0,
        right: isUser ? 0 : AppSpacing.xxxl,
      ),
      child: Column(
        crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.m),
            decoration: BoxDecoration(
              color: _bubbleColor(context, message.role),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (message.role == 'refusal') ...[
                  Row(children: [
                    const Icon(Icons.block_outlined, size: 14, color: AppColors.scorePoor),
                    const SizedBox(width: 4),
                    Text(
                      'Outside my scope',
                      style: AppType.labelSmall.copyWith(color: AppColors.scorePoor),
                    ),
                  ]),
                  const SizedBox(height: AppSpacing.xs),
                ],
                if (message.role == 'error')
                  Icon(Icons.wifi_off_outlined, size: 14, color: context.colors.subtle),
                Text(
                  message.text,
                  style: AppType.bodySmall.copyWith(
                    color: isUser ? context.colors.surface : context.colors.onSurface,
                  ),
                ),
                if (message.redirectNote != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    message.redirectNote!,
                    style: AppType.labelSmall.copyWith(color: AppColors.scorePoor),
                  ),
                ],
              ],
            ),
          ),
          if (message.citations.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            _CitationChips(citations: message.citations),
          ],
        ],
      ),
    );
  }

  Color _bubbleColor(BuildContext context, String role) {
    switch (role) {
      case 'user':     return context.colors.primary;
      case 'refusal':  return AppColors.scorePoor.withAlpha(20);
      case 'error':    return context.colors.surfaceVariant;
      default:         return context.colors.surfaceVariant;
    }
  }
}

// ── Citation chips ────────────────────────────────────────────────────────────────

class _CitationChips extends StatefulWidget {
  final List<Map<String, dynamic>> citations;
  const _CitationChips({required this.citations});

  @override
  State<_CitationChips> createState() => _CitationChipsState();
}

class _CitationChipsState extends State<_CitationChips> {
  int? _expanded;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: widget.citations.asMap().entries.map((e) {
            final i = e.key;
            final c = e.value;
            return GestureDetector(
              onTap: () => setState(() => _expanded = _expanded == i ? null : i),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: context.colors.primary.withAlpha(15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: context.colors.primary.withAlpha(60)),
                ),
                child: Text(
                  '[${i + 1}] ${c['source'] ?? ''}',
                  style: AppType.labelSmall.copyWith(color: context.colors.primary),
                ),
              ),
            );
          }).toList(),
        ),
        if (_expanded != null) ...[
          const SizedBox(height: AppSpacing.xs),
          Container(
            padding: const EdgeInsets.all(AppSpacing.s),
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: context.colors.divider),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.citations[_expanded!]['title'] as String? ?? '',
                  style: AppType.labelSmall,
                ),
                Text(
                  '${widget.citations[_expanded!]['source']} (${widget.citations[_expanded!]['year']})',
                  style: AppType.bodySmall.copyWith(color: context.colors.subtle),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// ── Auxiliary widgets ─────────────────────────────────────────────────────────────

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome_outlined, size: 48, color: context.colors.primary),
            const SizedBox(height: AppSpacing.m),
            const Text('Health Copilot', style: AppType.titleLarge),
            const SizedBox(height: AppSpacing.s),
            Text(
              'Ask me about nutrition, food labels, or healthy eating.\n'
              'I cite WHO, ICMR-NIN, and FSSAI guidelines.',
              style: AppType.bodySmall.copyWith(color: context.colors.subtle),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _ProductContextBanner extends StatelessWidget {
  final Map<String, dynamic> context;
  const _ProductContextBanner({required this.context});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m, vertical: AppSpacing.s),
      color: context.colors.primary.withAlpha(15),
      child: Row(children: [
        Icon(Icons.qr_code_scanner, size: 14, color: context.colors.primary),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            'Asking about: ${(this.context)['productName'] ?? 'scanned product'}',
            style: AppType.labelSmall.copyWith(color: context.colors.primary),
          ),
        ),
      ]),
    );
  }
}

class _DisclaimerBar extends StatelessWidget {
  const _DisclaimerBar();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.m, vertical: AppSpacing.s),
      color: context.colors.surfaceVariant,
      child: Text(
        'General nutrition information only — not medical advice. '
        'Consult a registered dietitian or doctor for personalised guidance.',
        style: AppType.labelSmall.copyWith(color: context.colors.subtle),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController controller;
  final bool loading;
  final VoidCallback onSend;

  const _InputBar({
    required this.controller,
    required this.loading,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.m),
        child: Row(children: [
          Expanded(
            child: TextField(
              controller: controller,
              decoration: const InputDecoration(
                hintText: 'Ask about nutrition or food labels…',
                border: OutlineInputBorder(),
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              maxLines: null,
            ),
          ),
          const SizedBox(width: AppSpacing.s),
          loading
              ? const SizedBox(
                  width: 40,
                  height: 40,
                  child: AppLoader(size: 20, strokeWidth: 2),
                )
              : IconButton(
                  icon: const Icon(Icons.send),
                  color: context.colors.primary,
                  onPressed: onSend,
                ),
        ]),
      ),
    );
  }
}
