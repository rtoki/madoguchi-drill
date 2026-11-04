#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 rtoki
# SPDX-License-Identifier: MIT

"""Python regression suites for packages, grammar, versions, assets and TypeScript."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import build as builder
import scenario_pack
import scenario_pack as COMPILER
from scenario_pack import ROOT, load_manifest, validate, ScenarioError, load_engine, version_tuple, check_compatibility, build_info

PROJECT = ROOT
SCRIPT = Path(__file__).with_name("scenario_pack.py")

# engine-version
class EngineVersions(unittest.TestCase):
    def setUp(self):
        self.engine = load_engine()
        self.manifest = json.loads((ROOT / 'scenarios/starter/manifest.json').read_text())

    def test_stable_version_numbers_are_numeric_and_unambiguous(self):
        self.assertGreater(version_tuple('1.10.0'), version_tuple('1.9.9'))
        for bad in ('v1.0.0', '01.0.0', '1.0', '1.0.0-rc.1', '1.0.0+dev', '1.0.0\n', 1, None):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                version_tuple(bad)

    def test_current_and_compatible_updates(self):
        for version in ('1.0.0', '1.0.1', '1.1.0', '1.10.0'):
            engine = {**self.engine, 'version': version}
            self.assertEqual(check_compatibility(self.manifest, engine), engine)

    def test_minimum_inclusive_and_upper_bound_exclusive(self):
        self.manifest['requiresEngine'] = {'minVersion': '1.9.0', 'maxVersionExclusive': '2.0.0'}
        for version in ('1.8.99', '2.0.0', '3.0.0'):
            with self.subTest(version=version), self.assertRaisesRegex(ValueError, '対応しません'):
                check_compatibility(self.manifest, {**self.engine, 'version': version})
        check_compatibility(self.manifest, {**self.engine, 'version': '1.9.0'})
        check_compatibility(self.manifest, {**self.engine, 'version': '1.10.0'})

    def test_bad_ranges_and_unsupported_formats(self):
        for field in ('schemaVersion', 'scriptVersion'):
            for value in (2, True, '1'):
                with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                    check_compatibility({**self.manifest, field: value}, self.engine)
        for bounds in (None, {}, {'minVersion': '2.0.0', 'maxVersionExclusive': '1.0.0'},
                       {'minVersion': '1.0.0', 'maxVersionExclusive': '1.0.0'}):
            with self.subTest(bounds=bounds), self.assertRaises(ValueError):
                check_compatibility({**self.manifest, 'requiresEngine': bounds}, self.engine)

    def test_engine_contract_is_validated(self):
        for field, value in [('id', 'different'), ('version', 'bad'), ('saveSchemaVersion', True),
                             ('scriptVersion', 0), ('scenarioSchemaVersion', '1')]:
            with tempfile.TemporaryDirectory() as directory:
                file = Path(directory) / 'version.json'
                file.write_text(json.dumps({**self.engine, field: value}))
                with self.subTest(field=field), self.assertRaises(ValueError):
                    load_engine(file)

    def test_incompatible_engine_stops_before_manuscript_compilation(self):
        with patch('scenario_pack.load_engine', return_value={**self.engine, 'version': '2.0.0'}), \
             patch('scenario_pack.compile_story', side_effect=AssertionError('compiler should not run')):
            with self.assertRaisesRegex(ValueError, '対応しません'):
                load_manifest('starter')

    def test_pack_metadata_is_separate_from_engine_and_migration_revisions(self):
        for name in ('komorebi', 'starter'):
            pack = load_manifest(name)
            info = build_info(pack)
            self.assertEqual(info['engine'], self.engine)
            self.assertEqual(info['scenario']['id'], name)
            self.assertEqual(info['scenario']['version'], pack['version'])
            self.assertEqual(info['scenario']['revision'], pack['revision'])
            self.assertNotIn('_dir', json.dumps(info))

# scenario-compiler
def fixture():
    metadata = {
        'scenes': ['bg', 'desk'], 'portraits': ['visitor'],
        'chapters': [{'id': 'first', 'act': 1, 'nodes': ['arrival', 'finish']}],
        'nodes': [{'id': 'arrival', 'title': '受付'}, {'id': 'finish', 'title': '終了'}],
        'decisions': {'reply': {'options': [
            {'id': 'ask', 'label': '用件を聞く'},
            {'id': 'wait', 'label': '待つ'},
            {'id': 'leave', 'label': '立ち去る', 'ending': 'missed'},
        ]}},
        'clues': {'answer': {'title': '返答', 'text': '住民の返答。'}},
        'puzzles': {},
        'bad_endings': {'missed': {'title': '不在', 'pages': [
            {'key': 'missed-final', 'scene': 'bg', 'text': '誰もいなくなった。'},
        ]}},
    }
    source = '''# 独立した短編

## arrival
@@ scene:desk
@@ portrait:visitor
「こちらですか」
男性が椅子を引いた。

@@ key:arrival-first
@@ time:09:05
@@ choice:reply

@@ route:reply=ask
「証明書をお願いします」

@@ key:visitor-answer
@@ clue:answer
@@ beat:reveal

@@ route:reply=wait
男性は手元のケースを開いた。

@@ key:visitor-waits

@@ common
@@ scene:desk
奥でプリンターが動き始めた。

@@ key:printer-starts

## finish
朝の受付が終わった。

@@ key:finish-morning
'''
    return metadata, source

class ScenarioCompilerTests(unittest.TestCase):
    def rejection(self, source, fragment, metadata=None):
        if metadata is None:
            metadata = fixture()[0]
        with self.assertRaises(COMPILER.CompileError) as result:
            COMPILER.compile_story(metadata, source, 'example.md')
        self.assertRegex(str(result.exception), r'^example\.md:\d+:')
        self.assertIn(fragment, str(result.exception))

    def test_compiles_scopes_clues_and_routes_without_changing_input(self):
        metadata, source = fixture()
        before = copy.deepcopy(metadata)
        story = COMPILER.compile_story(metadata, source)
        self.assertEqual(metadata, before)
        self.assertNotIn('scenes', story)
        self.assertNotIn('chapters', story)
        self.assertEqual(story['blocks'][0]['id'], 'first')
        pages = story['nodes'][0]['pages']
        self.assertEqual(pages[0]['text'], '「こちらですか」\n男性が椅子を引いた。')
        self.assertEqual(pages[0]['time'], '09:05')
        self.assertEqual(pages[0]['decision'], 'reply')
        self.assertNotIn('when', pages[0])
        self.assertEqual(pages[1]['when'], {'reply': 'ask'})
        self.assertEqual(pages[2]['when'], {'reply': 'wait'})
        self.assertEqual(pages[1]['portrait'], 'visitor')
        self.assertNotIn('portrait', pages[3])
        self.assertNotIn('when', pages[3])
        self.assertEqual(story['nodes'][1]['pages'][0]['scene'], 'bg')
        self.assertNotIn('portrait', story['nodes'][1]['pages'][0])
        self.assertEqual(story['clues']['answer']['pageKey'], 'visitor-answer')
        self.assertEqual(story['clues']['answer']['page'], 1)
        self.assertEqual(story['clues']['answer']['node'], 'arrival')
        self.assertEqual(story['clues']['answer']['when'], {'reply': 'ask'})
        self.assertEqual(story['stats']['routes'], 2)
        self.assertEqual(story['stats']['total_pages'], 6)
        self.assertEqual(story['stats']['path_pages_min'], 4)
        self.assertEqual(story['stats']['early_endings'], 1)

    def test_page_insert_keeps_existing_identifiers_and_rebuilds_clue_index(self):
        metadata, source = fixture()
        insertion = 'そのとき、奥の電話が鳴った。\n\n@@ key:phone-rings\n\n'
        story = COMPILER.compile_story(metadata, source.replace('@@ route:reply=ask', insertion + '@@ route:reply=ask'))
        self.assertEqual(story['clues']['answer']['pageKey'], 'visitor-answer')
        self.assertEqual(story['clues']['answer']['page'], 2)
        self.assertEqual(story['nodes'][0]['pages'][0]['key'], 'arrival-first')

    def test_rejects_missing_duplicate_and_misplaced_page_keys(self):
        _, source = fixture()
        self.rejection(source.replace('@@ key:visitor-answer\n', ''), '必須のページID')
        self.rejection(source.replace('@@ key:visitor-answer', '@@ key:arrival-first'), 'ページIDが重複')
        self.rejection(source.replace('## arrival', '## arrival\n@@ key:too-early'), '直前の本文がありません')
        self.rejection(source.replace('@@ key:arrival-first', '@@ key:arrival-first\n@@ key:second'), '二度指定')

    def test_identifiers_match_runtime_contract_and_reject_reserved_names(self):
        _, source = fixture()
        for value in ['constructor', 'prototype', '__proto__', '_first', 'first.page', '1first']:
            with self.subTest(value=value):
                self.rejection(source.replace('@@ key:arrival-first', '@@ key:' + value), 'ページID')
        for target in ['nodes', 'scenes', 'decisions', 'clues']:
            with self.subTest(target=target):
                metadata = fixture()[0]
                if target == 'nodes':
                    metadata['nodes'][0]['id'] = 'constructor'
                elif target == 'scenes':
                    metadata['scenes'].append('prototype')
                else:
                    metadata[target]['__proto__'] = {}
                self.rejection(source, '不正です', metadata)

    def test_rejects_unknown_instructions_and_references(self):
        _, source = fixture()
        for directive, message in [
            ('@@ jump:finish', '未知の指示'),
            ('@@ call:finish', '未知の指示'),
            ('@@ js:alert(1)', '未知の指示'),
            ('@@ scene:missing', '背景が未定義'),
            ('@@ portrait:missing', '人物画像が未定義'),
            ('@@ route:missing=ask', '条件が未定義'),
            ('@@ route:reply=missing', '条件が未定義'),
            ('@@ route:reply=leave', 'bad_endings'),
            ('@@ clue:missing', '手掛かりが未定義'),
            ('@@ choice:missing', '選択が未定義'),
            ('@@ time:24:00', 'HH:MM'),
            ('@@ beat:explode', '未対応の演出'),
        ]:
            with self.subTest(directive=directive):
                self.rejection(source.replace('@@ time:09:05', directive), message)

    def test_rejects_future_conditions_and_conditional_decisions(self):
        metadata, source = fixture()
        self.rejection(source.replace('@@ portrait:visitor', '@@ portrait:visitor\n@@ route:reply=ask'), 'まだ行われていません')
        metadata['decisions']['second'] = {'options': [{'id': 'yes'}, {'id': 'no'}]}
        self.rejection(source.replace('@@ key:visitor-answer', '@@ key:visitor-answer\n@@ choice:second'), '条件付きページ', metadata)

    def test_rejects_hidden_or_duplicate_story_structure(self):
        metadata, source = fixture()
        self.rejection(source.replace('## finish', '## unknown'), '場面が未定義')
        self.rejection(source + '\n## finish\n', '見出しが重複')
        self.rejection(source.split('## finish')[0], '一覧・順序が一致しません')
        self.rejection(source.replace('@@ choice:reply\n', '').replace('@@ route:reply=ask', '@@ common').replace('@@ route:reply=wait', '@@ common'), '配置されていない選択')
        self.rejection(source.replace('@@ clue:answer\n', ''), '配置されていない手掛かり')
        self.rejection(source.replace('@@ clue:answer', '@@ clue:answer\n@@ clue:answer'), '手掛かりを二度')
        metadata['nodes'][0]['pages'] = []
        self.rejection(source, '本文pagesは置けません', metadata)

    def test_validates_manually_authored_bad_ending_pages(self):
        metadata, source = fixture()
        metadata['bad_endings']['missed']['pages'] = []
        self.rejection(source, '早期終了の本文が空', metadata)
        for field, value, message in [('key', 'arrival-first', 'ページIDが重複'), ('scene', 'missing', '背景が未定義'), ('text', '', '本文が空'), ('time', 'noon', 'HH:MM'), ('when', {'unknown': 'ask'}, '条件が未定義')]:
            with self.subTest(field=field):
                metadata = fixture()[0]
                metadata['bad_endings']['missed']['pages'][0][field] = value
                self.rejection(source, message, metadata)

    def test_cli_writes_deterministically_and_keeps_output_on_invalid_input(self):
        metadata, source = fixture()
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            meta, manuscript, out = [base / name for name in ['metadata.json', 'manuscript.md', 'story.json']]
            meta.write_text(json.dumps(metadata, ensure_ascii=False), encoding='utf-8')
            manuscript.write_text(source, encoding='utf-8')
            command = [sys.executable, str(SCRIPT), 'compile', '--metadata', str(meta), '--manuscript', str(manuscript), '--out', str(out)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(out.read_text()), COMPILER.compile_story(metadata, source))
            before = out.read_bytes()
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(out.read_bytes(), before)
            manuscript.write_text(source + '\n@@ call:missing\n', encoding='utf-8')
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 1)
            self.assertIn('未知の指示', result.stderr)
            self.assertEqual(out.read_bytes(), before)
            command[-1] = str(meta)
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(json.loads(meta.read_text()), metadata)

# scenario-pack
class ScenarioContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = load_manifest('komorebi')
        cls.sample = load_manifest('starter')

    def rejects(self, edit, pattern, source=None):
        pack = copy.deepcopy(source or self.sample)
        edit(pack)
        with self.assertRaisesRegex(ScenarioError, pattern):
            validate(pack)

    def test_fantasy_revision_preserves_playable_structure_and_rescue(self):
        import hashlib, json
        from pathlib import Path
        def digest(value):
            return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        before = json.loads((Path(__file__).parent / 'fixtures/komorebi-contract.json').read_text())
        after = self.original['story']
        self.assertEqual([n['id'] for n in before['nodes']], [n['id'] for n in after['nodes']])
        self.assertEqual(before['decisions'], digest(after['decisions']))
        self.assertEqual(before['blocks'], [b['nodes'] for b in after['blocks']])
        for previous, current in zip(before['nodes'], after['nodes']):
            old_keys = previous['keys']
            new_keys = [p['key'] for p in current['pages']]
            self.assertEqual(old_keys, [key for key in new_keys if key in old_keys])
            self.assertTrue(all(key.startswith('paper-') for key in set(new_keys) - set(old_keys)))
            if 'training' in previous:
                self.assertEqual(previous['training'], digest(current))
            for page in current['pages']:
                if page['key'] in previous['pages']:
                    self.assertEqual(previous['pages'][page['key']], digest({k: v for k, v in page.items() if k not in ('text', 'time')}))
        self.assertEqual(before['rescue_delay'], digest(after['bad_endings']['rescue_delay']))
        rescue = next(n for n in after['nodes'] if n['id'] == 'noon')['pages']
        self.assertEqual(before['rescue_pages'], {p['key']: digest(p) for p in rescue if p['key'] in before['rescue_pages']})
        self.assertEqual(before['routes'], after['stats']['routes'])
        self.assertEqual(before['early_endings'], after['stats']['early_endings'])

    def test_independent_save_namespaces(self):
        self.assertEqual(self.sample['saveKey'], 'madoguchi.scenario.starter.v1')
        self.assertNotEqual(self.sample['saveKey'], self.original['saveKey'])
        self.assertNotEqual(self.sample['bestKey'], self.original['bestKey'])

    def test_future_condition_cannot_hide_required_evidence(self):
        def edit(p):
            page = next(q for n in p['story']['nodes'] for q in n['pages'] if 'husband_quote' in q.get('clues', []))
            page['when'] = {'envelope': 'sealed'}
        self.rejects(edit, 'まだ選択していない', self.original)

    def test_cannot_skip_evidence_scene(self):
        self.rejects(lambda p: p['story']['nodes'][2].update(needs=['arrival']), '直前')

    def test_evidence_is_required_on_each_success_route(self):
        def edit(p):
            p['story']['decisions']['response']['options'].append({'id': 'wait', 'label': '待つ'})
            p['story']['nodes'][1]['pages'][0]['when'] = {'response': 'ask'}
        self.rejects(edit, '必須の根拠')

    def test_bad_ending_integrity(self):
        self.rejects(lambda p: p['story']['bad_endings']['wrong_owner'].update(pages=[]), '結末の本文が空')
        self.rejects(lambda p: p['story']['bad_endings']['wrong_owner'].update(node='inspection'), '戻り先に選択')
        self.rejects(lambda p: p['story']['bad_endings']['wrong_owner']['pages'][0].update(scene='missing'), '結末の背景')
        self.rejects(lambda p: p['story']['bad_endings']['wrong_owner']['pages'][0].update(key='arrival-paper'), '重複')

    def test_unsafe_id_and_missing_explanation(self):
        self.rejects(lambda p: p['story']['nodes'][0]['pages'][0].update(key='constructor'), 'IDが不正')
        self.rejects(lambda p: p['story']['clues']['number'].pop('text'), '説明が不足')

    def test_asset_tampering_and_escape(self):
        self.rejects(lambda p: next(iter(p['assets'].values())).update(sha256='0'*64), '素材が台帳と異なり')
        self.rejects(lambda p: next(iter(p['assets'].values())).update(file='/etc/passwd'), '相対パス')

    def test_sound_effect_targets_and_names(self):
        for effect in ('telephone', {'kind': 'telephone', 'after': 'これ'}):
            self.rejects(lambda p: p['sound']['effects'].update({'wrong-owner-end': effect}), '通常本文')
        for effect in ('moblie', '', {'kind': 'moblie', 'after': '手帳'}):
            self.rejects(lambda p: p['sound']['effects'].update({'arrival-paper': effect}), '効果音の種類')
        for marker in ('本文にない言葉', ' \n '):
            self.rejects(lambda p: p['sound']['effects'].update({'arrival-paper': {'kind': 'paper', 'after': marker}}), '発音位置')

    def test_scene_music_contract(self):
        self.rejects(lambda p: p['sound'].update(scenes=[]), 'オブジェクト')
        self.rejects(lambda p: p['sound'].update(scenes={'missing': 'counter'}), '場面がありません')
        for track in ('missing', None, {}, []):
            self.rejects(lambda p: p['sound'].update(scenes={p['story']['nodes'][0]['id']: track}), 'BGMが未定義')
        pack = copy.deepcopy(self.sample)
        pack['sound']['scenes'] = {pack['story']['nodes'][0]['id']: 'counter'}
        validate(pack)

    def test_sound_marker_survives_reading_layout(self):
        pack = copy.deepcopy(self.sample)
        page = pack['story']['nodes'][0]['pages'][0]
        page['text'] = '携帯が鳴る。\n机から取り上げた。'
        pack['sound']['effects'] = {page['key']: {'kind': 'mobile', 'after': '携帯が鳴る。机から取り上げた。'}}
        validate(pack)

    def test_visual_moments_contract(self):
        self.rejects(lambda p: p.update(moments=[]), 'オブジェクト')
        self.rejects(lambda p: p.update(moments={'missing': {'kind': 'photo'}}), 'ページがありません')
        for scene in ('missing', [], None):
            self.rejects(lambda p: p['moments']['paper-two-daughters'].update(scene=scene), '写真がありません', self.original)
        self.rejects(lambda p: p['moments']['paper-effect-discovered'].update(rows=[]), '1〜4行', self.original)
        self.rejects(lambda p: p['moments']['paper-empty-place']['frames'][0].update(quote='本文にない結論'), '元の本文にありません', self.original)
        self.rejects(lambda p: p['moments']['paper-empty-place']['frames'][0].update(page='paper-closing-light'), '既出', self.original)
        self.rejects(lambda p: p['moments']['paper-empty-place']['frames'][0].update(page='report-013'), '分岐限定', self.original)
        for duration in (0, 20000, float('nan'), '4000'):
            self.rejects(lambda p: p['moments']['paper-empty-place']['frames'][0].update(duration=duration), '表示時間', self.original)
        self.assertEqual(self.sample['moments'], {}, 'scenarios without moments stay unchanged')

    def test_invalid_clock_and_scene_bounds(self):
        self.rejects(lambda p: p['story']['nodes'][0].update(time='25:00'), '時刻が不正')
        self.rejects(lambda p: p['story']['nodes'][0]['pages'][0].update(time='16:99'), '時刻が不正')
        self.rejects(lambda p: p['story']['nodes'][1].update(time='16:49'), '時刻が逆行')
        self.rejects(lambda p: p['story']['nodes'][0]['pages'][0].update(time='16:52'), '場面の時刻範囲')
        self.rejects(lambda p: p['story']['nodes'][0]['pages'][0].update(dayOffset=-1), '日数が不正')
        self.rejects(lambda p: p['story']['nodes'][0].update(endTime='16:49'), '終了時刻')

    def test_bad_ending_clock_can_cross_midnight_explicitly(self):
        self.rejects(lambda p: p['story']['bad_endings']['wrong_owner']['pages'][0].update(time='08:55'), '場面の時刻範囲')
        pack = copy.deepcopy(self.sample)
        ending = pack['story']['bad_endings']['wrong_owner']
        ending.update(endTime='08:55', endDayOffset=1)
        ending['pages'][0].update(time='08:55', dayOffset=1)
        validate(pack)

    def test_clock_order_is_checked_on_each_route(self):
        def edit(p):
            pages = next(n for n in p['story']['nodes'] if n['id'] == 'instructions')['pages']
            index = next(i for i, page in enumerate(pages) if page.get('when'))
            pages[index]['time'] = '16:43'
        self.rejects(edit, '時刻が逆行', self.original)
        pack = copy.deepcopy(self.original)
        pages = next(n for n in pack['story']['nodes'] if n['id'] == 'instructions')['pages']
        next(page for page in pages if page['key'] == 'instructions-015')['time'] = '16:50'
        validate(pack)  # Mutually exclusive 16:50 and 16:49 pages are not a rollback.

# scenario-assets
class ContributorAssets(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = (Path(self.temp.name) / 'game').resolve()
        for directory in ('images', 'motion', 'audio', 'scenarios/demo/assets', 'engine/icons'):
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        shutil.copytree(PROJECT / 'licenses', self.root / 'licenses')
        shutil.copy2(PROJECT.parent / 'LICENSE', self.root.parent / 'LICENSE')
        (self.root / 'motion/manifest.json').write_text('[]')
        (self.root / 'audio/manifest.json').write_text('{"tracks":[]}')
        self.image = self.root / 'scenarios/demo/assets/test.png'
        self.image.write_bytes(b'original contributor image fixture')
        self.asset = {'file': 'assets/test.png', 'mime': 'image/png',
                      'sha256': hashlib.sha256(self.image.read_bytes()).hexdigest(),
                      'creator': 'Independent contributor', 'license': 'CC0-1.0',
                      'source': 'https://example.org/contributor-image',
                      'changes': 'Resized for this scenario.'}
        self.assets = self.root / 'scenarios/demo/assets.json'
        self.write_asset()
        (self.root / 'scenarios/demo/manifest.json').write_text('{"assets":"assets.json"}')
        self.addCleanup(patch.stopall)
        patch.object(builder, 'ROOT', self.root).start()
        patch.object(builder, 'LICENSES', self.root / 'licenses').start()
        patch.object(scenario_pack, 'ROOT', self.root).start()

    def write_asset(self):
        self.assets.write_text(json.dumps({'new-image': self.asset}))

    def test_build_keeps_contributor_credit_license_source_and_changes(self):
        hook = '<details class="console-options license-notices"><summary>利用条件・クレジット</summary>${licenseNoticesHTML()}</details>'
        (self.root / 'index.html').write_text('/* BEGIN LICENSE NOTICES */old/* END LICENSE NOTICES */' + hook)
        builder.build_licenses()
        record, = json.loads((self.root / 'licenses/assets.json').read_text())['assets']
        for key in ('creator', 'license', 'source', 'changes', 'sha256'):
            self.assertEqual(record[key], self.asset[key])
        self.assertNotIn('AI-generated', record['provenance'])
        self.assertEqual(record['records'], 'scenarios/demo/assets.json')

    def test_modified_file_is_rejected(self):
        self.image.write_bytes(b'changed without updating its manifest')
        with self.assertRaisesRegex(ValueError, 'no longer matches'):
            builder.declared_assets()

    def test_conflicting_credits_for_one_file_are_rejected(self):
        other = self.root / 'scenarios/other'
        other.mkdir()
        (other / 'manifest.json').write_text('{"assets":"assets.json"}')
        (other / 'assets.json').write_text(json.dumps({'same': {**self.asset, 'file': '../demo/assets/test.png', 'creator': 'Wrong author'}}))
        with self.assertRaisesRegex(ValueError, 'Conflicting asset credits'):
            builder.declared_assets()

    def test_missing_creator_and_external_path_are_rejected(self):
        self.asset['creator'] = ''
        self.write_asset()
        with self.assertRaisesRegex(ValueError, 'creator and license'):
            builder.declared_assets()
        self.asset['creator'] = 'Independent contributor'
        self.asset['file'] = '../../../LICENSE'
        self.write_asset()
        with self.assertRaisesRegex(ValueError, 'プロジェクト外'):
            builder.declared_assets()

# typescript
class TypedEngine(unittest.TestCase):
    def test_positive_and_negative_contract_examples(self):
        subprocess.run(['node', str(ROOT / 'node_modules/typescript/bin/tsc'), '--project', str(ROOT / 'tsconfig.type-tests.json')], cwd=ROOT, check=True)

    def test_invalid_source_produces_type_diagnostic(self):
        with tempfile.TemporaryDirectory(dir=ROOT / 'build') as folder:
            folder = Path(folder)
            (folder / 'invalid.ts').write_text('GAME_READER.setSpeed(123);\n')
            config = {'extends': str(ROOT / 'tsconfig.json'),
                      'compilerOptions': {'rootDir': str(ROOT), 'noEmit': True},
                      'include': [str(ROOT / 'engine/**/*.ts'), str(folder / 'invalid.ts')]}
            (folder / 'tsconfig.json').write_text(json.dumps(config))
            result = subprocess.run(['node', str(ROOT / 'node_modules/typescript/bin/tsc'), '--project', str(folder / 'tsconfig.json')], cwd=ROOT, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('TS2345', result.stdout)

    def test_failed_compilation_never_replaces_a_game(self):
        assembler = builder
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'index.html'
            output.write_bytes(b'previous playable output')
            with patch.object(assembler, 'compile_engine', side_effect=SystemExit('type error')):
                with self.assertRaisesRegex(SystemExit, 'type error'):
                    assembler.build_game('starter', output)
            self.assertEqual(output.read_bytes(), b'previous playable output')

    def test_no_unchecked_typescript_escape_hatches(self):
        config = json.loads((ROOT / 'tsconfig.json').read_text())['compilerOptions']
        self.assertTrue(config['strict'])
        self.assertTrue(config['noUncheckedIndexedAccess'])
        self.assertTrue(config['noEmitOnError'])
        for source in (ROOT / 'engine').rglob('*.ts'):
            text = source.read_text()
            self.assertNotIn('@ts-nocheck', text, source.name)
            self.assertNotIn('@ts-ignore', text, source.name)
            self.assertNotRegex(text, r'\bany\b', source.name)

if __name__ == '__main__':
    unittest.main(verbosity=2)
