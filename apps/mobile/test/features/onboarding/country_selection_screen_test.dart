// Widget tests for the Phase 10 (`global.p10.country_onboarding_v2`) presentational components.
// Self-contained — CountrySuggestionView/CountryPickerList receive data via constructor params,
// so these don't need to mock the network layer (ApiClient wraps a private Dio instance with no
// injection point, so full-screen integration testing isn't practical without a larger,
// riskier refactor of a class many other screens depend on).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nutrimind_country_engine/nutrimind_country_engine.dart';
import 'package:nutrimind/features/onboarding/screens/country_selection_screen.dart';

void main() {
  group('CountrySuggestionView', () {
    testWidgets('shows the suggested country name', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: CountrySuggestionView(
          suggested: CountryProfile.india,
          saving: false,
          error: null,
          onConfirm: () {},
          onPickDifferent: () {},
        ),
      ));
      expect(find.text('India'), findsOneWidget);
    });

    testWidgets('disables the confirm button while saving', (tester) async {
      var tapped = false;
      await tester.pumpWidget(MaterialApp(
        home: CountrySuggestionView(
          suggested: CountryProfile.india,
          saving: true,
          error: null,
          onConfirm: () => tapped = true,
          onPickDifferent: () {},
        ),
      ));
      final button = tester.widget<FilledButton>(find.byType(FilledButton));
      expect(button.onPressed, isNull);
      expect(tapped, isFalse);
    });

    testWidgets('confirm button is tappable when not saving', (tester) async {
      var tapped = false;
      await tester.pumpWidget(MaterialApp(
        home: CountrySuggestionView(
          suggested: CountryProfile.india,
          saving: false,
          error: null,
          onConfirm: () => tapped = true,
          onPickDifferent: () {},
        ),
      ));
      await tester.tap(find.text('Yes, this is right'));
      expect(tapped, isTrue);
    });

    testWidgets('shows an error message when provided', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: CountrySuggestionView(
          suggested: CountryProfile.india,
          saving: false,
          error: 'Could not save your country.',
          onConfirm: () {},
          onPickDifferent: () {},
        ),
      ));
      expect(find.text('Could not save your country.'), findsOneWidget);
    });

    testWidgets('tapping "Choose a different country" invokes the callback', (tester) async {
      var pickedDifferent = false;
      await tester.pumpWidget(MaterialApp(
        home: CountrySuggestionView(
          suggested: CountryProfile.india,
          saving: false,
          error: null,
          onConfirm: () {},
          onPickDifferent: () => pickedDifferent = true,
        ),
      ));
      await tester.tap(find.text('Choose a different country'));
      expect(pickedDifferent, isTrue);
    });
  });

  group('CountryPickerList', () {
    final countries = [
      CountryProfile.india,
      CountryRegistry.lookupOrGlobal('GB'),
      CountryRegistry.lookupOrGlobal('US'),
    ];

    testWidgets('lists all countries when search is empty', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CountryPickerList(
            countries: countries,
            search: '',
            onSearchChanged: (_) {},
            onSelected: (_) {},
            onBack: () {},
          ),
        ),
      ));
      expect(find.text('India'), findsOneWidget);
      expect(find.text('United Kingdom'), findsOneWidget);
      expect(find.text('United States'), findsOneWidget);
    });

    testWidgets('filters the list by search text', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CountryPickerList(
            countries: countries,
            search: 'united k',
            onSearchChanged: (_) {},
            onSelected: (_) {},
            onBack: () {},
          ),
        ),
      ));
      expect(find.text('United Kingdom'), findsOneWidget);
      expect(find.text('India'), findsNothing);
      expect(find.text('United States'), findsNothing);
    });

    testWidgets('tapping a country invokes onSelected with that country', (tester) async {
      CountryProfile? selected;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CountryPickerList(
            countries: countries,
            search: '',
            onSearchChanged: (_) {},
            onSelected: (c) => selected = c,
            onBack: () {},
          ),
        ),
      ));
      await tester.tap(find.text('United Kingdom'));
      expect(selected?.isoCode, 'GB');
    });

    testWidgets('list items are not tappable when onSelected is null (saving in progress)', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CountryPickerList(
            countries: countries,
            search: '',
            onSearchChanged: (_) {},
            onSelected: null,
            onBack: () {},
          ),
        ),
      ));
      final tile = tester.widget<ListTile>(find.widgetWithText(ListTile, 'India'));
      expect(tile.onTap, isNull);
    });

    testWidgets('back button invokes onBack', (tester) async {
      var wentBack = false;
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: CountryPickerList(
            countries: countries,
            search: '',
            onSearchChanged: (_) {},
            onSelected: (_) {},
            onBack: () => wentBack = true,
          ),
        ),
      ));
      await tester.tap(find.byIcon(Icons.arrow_back));
      expect(wentBack, isTrue);
    });
  });
}
