#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 rtoki
# SPDX-License-Identifier: MIT

"""Scenario compilation, package validation and version contracts."""
import argparse
import copy
import hashlib
import itertools
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]

# Version compatibility
STABLE_VERSION = re.compile(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z')


def version_tuple(value):
    match = STABLE_VERSION.fullmatch(value) if isinstance(value, str) else None
    if not match:
        raise ValueError(f'正式版の番号 X.Y.Z を指定してください（先頭のvは不要）: {value!r}')
    return tuple(int(part) for part in match.groups())


def load_engine(path=None):
    engine = json.loads(Path(path or ROOT / 'engine/version.json').read_text())
    if engine.get('id') != 'madoguchi-drill-engine':
        raise ValueError('エンジンIDが不正です')
    version_tuple(engine.get('version'))
    for field in ('scenarioSchemaVersion', 'scriptVersion', 'saveSchemaVersion'):
        if type(engine.get(field)) is not int or engine[field] < 1:
            raise ValueError(f'形式の版は1以上の整数が必要です: {field}')
    return engine


def check_compatibility(manifest, engine=None):
    engine = engine if engine is not None else load_engine()
    version_tuple(manifest.get('version'))
    requirement = manifest.get('requiresEngine')
    if not isinstance(requirement, dict):
        raise ValueError('シナリオのrequiresEngineに対応エンジンの範囲が必要です')
    minimum = version_tuple(requirement.get('minVersion'))
    maximum = version_tuple(requirement.get('maxVersionExclusive'))
    if minimum >= maximum:
        raise ValueError('requiresEngineの上限は下限より大きくしてください')
    current = version_tuple(engine['version'])
    if not minimum <= current < maximum:
        raise ValueError(f'エンジン v{engine["version"]} はこのシナリオに対応しません。'
                         f'必要な版: {requirement["minVersion"]} 以上、'
                         f'{requirement["maxVersionExclusive"]} 未満')
    for field, engine_field in (('schemaVersion', 'scenarioSchemaVersion'), ('scriptVersion', 'scriptVersion')):
        if type(manifest.get(field)) is not int or manifest[field] != engine[engine_field]:
            raise ValueError(f'未対応の{field}です: {manifest.get(field)!r} '
                             f'（このエンジンは{engine[engine_field]}に対応）')
    return engine


def build_info(pack):
    return {
        'schemaVersion': 1,
        'engine': pack['_engine'],
        'scenario': {key: pack[key] for key in
                     ('id', 'version', 'schemaVersion', 'scriptVersion', 'revision', 'layoutRevision', 'requiresEngine')},
    }

# Manuscript compiler
class CompileError(ValueError):
    pass


IDENTIFIER = re.compile(r'[A-Za-z][A-Za-z0-9_-]*\Z')


RESERVED_IDS = {'constructor', 'prototype', '__proto__'}


CLOCK = re.compile(r'(?:[01][0-9]|2[0-3]):[0-5][0-9]\Z')


def compile_story(metadata, source, source_name='<script>'):
    """Return a new story object, without mutating metadata or touching files."""
    def fail(line, message):
        raise CompileError(f'{source_name}:{line}: {message}')

    def check_id(value, line, label):
        if not isinstance(value, str) or not IDENTIFIER.fullmatch(value) or value in RESERVED_IDS:
            fail(line, f'{label}が不正です: {value!r}')

    if not isinstance(metadata, dict) or not isinstance(source, str):
        fail(1, 'metadata はオブジェクト、本文は文字列で指定してください')
    story = copy.deepcopy(metadata)
    if 'chapters' in story:
        if 'blocks' in story:
            fail(1, 'metadata の chapters と blocks は同時に指定できません')
        story['blocks'] = story.pop('chapters')
    scenes = story.pop('scenes', None)
    portraits = story.pop('portraits', [])
    for name, values in [('scenes', scenes), ('portraits', portraits)]:
        if not isinstance(values, list) or len(values) != len(set(v for v in values if isinstance(v, str))):
            fail(1, f'metadata.{name} は重複のないID配列が必要です')
        for value in values:
            check_id(value, 1, name)
    if not scenes:
        fail(1, 'metadata.scenes に背景IDを定義してください')
    nodes = story.get('nodes')
    if not isinstance(nodes, list) or not nodes:
        fail(1, 'metadata.nodes に場面を定義してください')
    nodes_by_id = {}
    for node in nodes:
        if not isinstance(node, dict):
            fail(1, 'metadata.nodes の各場面はオブジェクトにしてください')
        check_id(node.get('id'), 1, '場面ID')
        if node['id'] in nodes_by_id:
            fail(1, f'場面IDが重複しています: {node["id"]}')
        if 'pages' in node:
            fail(1, f'metadata.nodes に本文pagesは置けません: {node["id"]}')
        node['pages'] = []
        nodes_by_id[node['id']] = node
    decisions = story.setdefault('decisions', {})
    clues = story.setdefault('clues', {})
    endings = story.setdefault('bad_endings', {})
    for name, value in [('decisions', decisions), ('clues', clues), ('bad_endings', endings)]:
        if not isinstance(value, dict):
            fail(1, f'metadata.{name} はオブジェクトにしてください')
        for key in value:
            check_id(key, 1, name)
    choices = {}
    for key, decision in decisions.items():
        options = decision.get('options') if isinstance(decision, dict) else None
        if not isinstance(options, list) or len(options) < 2:
            fail(1, f'選択肢は二つ以上必要です: {key}')
        choices[key] = {}
        for option in options:
            if not isinstance(option, dict):
                fail(1, f'選択肢はオブジェクトにしてください: {key}')
            oid = option.get('id')
            check_id(oid, 1, '選択肢ID')
            if oid in choices[key]:
                fail(1, f'選択肢IDが重複しています: {key}/{oid}')
            if option.get('ending') and (not isinstance(option['ending'], str) or option['ending'] not in endings):
                fail(1, f'結末が未定義です: {option["ending"]}')
            choices[key][oid] = option

    current = None
    scene, portrait, route = None, None, None
    paragraph, paragraph_line = [], 0
    node_order, locations, condition_locations = [], {}, {}

    def flush():
        nonlocal paragraph
        if not paragraph:
            return
        if current is None:
            fail(paragraph_line, '本文の前に ## 場面ID が必要です')
        if scene is None:
            fail(paragraph_line, '本文の前に @@ scene:背景ID が必要です')
        page = {'scene': scene, 'text': '\n'.join(paragraph).strip()}
        if portrait:
            page['portrait'] = portrait
        if route:
            page['when'] = dict(route)
        current['pages'].append(page)
        locations[id(page)] = paragraph_line
        condition_locations[id(page)] = route_line if route else paragraph_line
        paragraph = []

    route_line = 1
    for line_number, raw in enumerate(source.splitlines(), 1):
        line = raw.strip()
        if not line:
            flush()
            continue
        if line.startswith('# '):
            if current is not None or paragraph:
                fail(line_number, '文書タイトルは最初の場面より前に置いてください')
            continue
        if line.startswith('##'):
            flush()
            match = re.fullmatch(r'##\s+([A-Za-z][A-Za-z0-9_-]*)', line)
            if not match or match[1] not in nodes_by_id:
                fail(line_number, f'場面が未定義、または見出しの形式が不正です: {line}')
            if match[1] in node_order:
                fail(line_number, f'場面の見出しが重複しています: {match[1]}')
            current = nodes_by_id[match[1]]
            node_order.append(match[1])
            scene = 'bg' if 'bg' in scenes else None
            portrait, route = None, None
            continue
        if line.startswith('@@'):
            flush()
            if current is None:
                fail(line_number, '指示の前に ## 場面ID が必要です')
            if not line.startswith('@@ '):
                fail(line_number, '指示は @@ と空白で始めてください')
            command, separator, value = line[3:].partition(':')
            value = value.strip()
            if command == 'common' and not separator:
                route = None
                continue
            if command not in {'scene', 'portrait', 'route', 'key', 'time', 'clue', 'choice', 'beat'}:
                fail(line_number, f'未知の指示です: {command}')
            if not separator or not value:
                fail(line_number, f'指示の値がありません: {command}')
            if command == 'scene':
                if value not in scenes:
                    fail(line_number, f'背景が未定義です: {value}')
                scene, portrait = value, None
            elif command == 'portrait':
                if value not in portraits:
                    fail(line_number, f'人物画像が未定義です: {value}')
                portrait = value
            elif command == 'route':
                key, equals, option = value.partition('=')
                if not equals or key not in choices or option not in choices[key]:
                    fail(line_number, f'条件が未定義です: {value}')
                if choices[key][option].get('ending'):
                    fail(line_number, f'終了する選択肢の本文は bad_endings に置いてください: {value}')
                route, route_line = {key: option}, line_number
            else:
                if not current['pages']:
                    fail(line_number, f'{command} を付ける直前の本文がありません')
                page = current['pages'][-1]
                field = {'choice': 'decision', 'clue': 'clues'}.get(command, command)
                if command == 'clue':
                    if value not in clues:
                        fail(line_number, f'手掛かりが未定義です: {value}')
                    page.setdefault(field, []).append(value)
                else:
                    if field in page:
                        fail(line_number, f'同じページに {command} を二度指定しています')
                    if command == 'key':
                        check_id(value, line_number, 'ページID')
                    elif command == 'time' and not CLOCK.fullmatch(value):
                        fail(line_number, f'時刻は HH:MM で指定してください: {value}')
                    elif command == 'choice' and value not in choices:
                        fail(line_number, f'選択が未定義です: {value}')
                    elif command == 'beat' and value != 'reveal':
                        fail(line_number, f'未対応の演出です: {value}')
                    page[field] = value
            continue
        if not paragraph:
            paragraph_line = line_number
        paragraph.append(raw)
    flush()
    if node_order != list(nodes_by_id):
        fail(1, 'metadata.nodes と本文見出しの一覧・順序が一致しません')

    page_keys, placed_choices, published = set(), set(), {}

    def validate_page(page, node_id, index, terminal=False):
        line = locations.get(id(page), 1)
        if not isinstance(page, dict):
            fail(line, f'ページはオブジェクトにしてください: {node_id}')
        key = page.get('key')
        check_id(key, line, '必須のページID (@@ key)')
        if key in page_keys:
            fail(line, f'ページIDが重複しています: {key}')
        page_keys.add(key)
        if not isinstance(page.get('text'), str) or not page['text'].strip():
            fail(line, f'本文が空です: {key}')
        if page.get('scene') not in scenes:
            fail(line, f'背景が未定義です: {key}/{page.get("scene")}')
        if page.get('portrait') and page['portrait'] not in portraits:
            fail(line, f'人物画像が未定義です: {key}/{page["portrait"]}')
        if 'time' in page and (not isinstance(page['time'], str) or not CLOCK.fullmatch(page['time'])):
            fail(line, f'時刻は HH:MM で指定してください: {key}')
        if 'beat' in page and page['beat'] != 'reveal':
            fail(line, f'未対応の演出です: {key}')
        when = page.get('when', {})
        if not isinstance(when, dict):
            fail(line, f'条件はオブジェクトにしてください: {key}')
        for decision, value in when.items():
            if decision not in choices or not isinstance(value, str) or value not in choices[decision]:
                fail(line, f'条件が未定義です: {decision}={value}')
            if decision not in placed_choices:
                fail(condition_locations.get(id(page), line), f'条件の選択がまだ行われていません: {decision}')
        if page.get('decision'):
            decision = page['decision']
            if not isinstance(decision, str) or decision not in choices:
                fail(line, f'選択が未定義です: {decision}')
            if terminal or when:
                fail(line, '条件付きページ・早期終了には選択を置けません')
            if decision in placed_choices:
                fail(line, f'選択を二度配置しています: {decision}')
            placed_choices.add(decision)
        attached = page.get('clues', [])
        if not isinstance(attached, list):
            fail(line, f'手掛かりはID配列にしてください: {key}')
        for clue_id in attached:
            if not isinstance(clue_id, str) or clue_id not in clues:
                fail(line, f'手掛かりが未定義です: {clue_id}')
            if terminal:
                fail(line, '推理の手掛かりは早期終了ではなく通常本文に置いてください')
            if clue_id in published:
                fail(line, f'手掛かりを二度配置しています: {clue_id}')
            clue = clues[clue_id]
            if not isinstance(clue, dict):
                fail(line, f'手掛かりはオブジェクトにしてください: {clue_id}')
            clue.update(node=node_id, page=index, pageKey=key)
            clue.pop('when', None)
            if when:
                clue['when'] = dict(when)
            published[clue_id] = page

    for node in nodes:
        if not node['pages'] and not node.get('training'):
            fail(1, f'本文が空です: {node["id"]}')
        for index, page in enumerate(node['pages']):
            validate_page(page, node['id'], index)
    if placed_choices != set(decisions):
        fail(1, f'本文に配置されていない選択があります: {sorted(set(decisions)-placed_choices)}')
    if set(published) != set(clues):
        fail(1, f'本文に配置されていない手掛かりがあります: {sorted(set(clues)-set(published))}')
    for ending_id, ending in endings.items():
        if not isinstance(ending, dict) or not isinstance(ending.get('pages'), list) or not ending['pages']:
            fail(1, f'早期終了の本文が空です: {ending_id}')
        for index, page in enumerate(ending['pages']):
            validate_page(page, ending_id, index, terminal=True)

    pages = [page for node in nodes for page in node['pages']]
    ending_pages = [page for ending in endings.values() for page in ending['pages']]
    paths = [[oid for oid, option in options.items() if not option.get('ending')] for options in choices.values()]
    path_count = 1
    for path in paths:
        if not path:
            fail(1, '通常ルートのない選択があります')
        path_count *= len(path)
    if path_count > 512:
        fail(1, '分岐が検証上限の512経路を超えています')
    path_chars, path_pages = [], []
    for values in itertools.product(*paths):
        picks = dict(zip(choices, values))
        visible = [p for p in pages if all(picks.get(k) == v for k, v in p.get('when', {}).items())]
        path_chars.append(sum(len(p['text']) for p in visible))
        path_pages.append(len(visible))
    story.setdefault('schema_version', 3)
    story['stats'] = {
        'total_chars': sum(len(p['text']) for p in pages + ending_pages),
        'total_pages': len(pages) + len(ending_pages),
        'choices': len(choices), 'routes': path_count, 'early_endings': len(endings),
        'total_paths': path_count + len(endings),
        'core_clues': sum(not c.get('when') for c in clues.values()), 'all_clues': len(clues),
        'path_chars_min': min(path_chars), 'path_chars_max': max(path_chars),
        'path_pages_min': min(path_pages), 'path_pages_max': max(path_pages),
        'max_page_chars': max((len(p['text']) for p in pages + ending_pages), default=0),
        'bad_ending_chars': sum(len(p['text']) for p in ending_pages),
    }
    return story


def compile_main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata', required=True, type=Path)
    parser.add_argument('--manuscript', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    args = parser.parse_args(argv)
    if args.out.resolve() in {args.metadata.resolve(), args.manuscript.resolve()}:
        parser.error('出力先を入力ファイルと同じにできません')
    try:
        metadata = json.loads(args.metadata.read_text(encoding='utf-8'))
        compiled = compile_story(metadata, args.manuscript.read_text(encoding='utf-8'), str(args.manuscript))
        args.out.write_text(json.dumps(compiled, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    except (OSError, ValueError) as error:
        print(error, file=sys.stderr)
        return 1
    print(f'{args.out}: {compiled["stats"]["total_pages"]} pages, {compiled["stats"]["choices"]} choices')
    return 0

# Package loader and validation
SCENE_EFFECTS = {
    'click', 'paper', 'stamp', 'call', 'turn', 'card', 'envelope', 'keyboard',
    'printer', 'ticket', 'coins', 'chair', 'steps', 'door', 'receiver',
    'telephone', 'mobile', 'water', 'arrival',
}


class ScenarioError(ValueError):
    pass


def require(value, message):
    if not value:
        raise ScenarioError(message)


def story_time(value, day, label):
    require(type(day) is int and day >= 0, f'日数が不正です: {label}')
    require(isinstance(value, str) and re.fullmatch(r'(?:[01][0-9]|2[0-3]):[0-5][0-9]', value),
            f'時刻が不正です: {label}/{value}')
    hours, minutes = map(int, value.split(':'))
    return day * 1440 + hours * 60 + minutes


def timed_pages(scene, start, day):
    """Validate all pages, including alternatives, without ordering exclusive routes."""
    end = None
    if 'endTime' in scene:
        end = story_time(scene['endTime'], scene.get('endDayOffset', day), scene.get('id', '結末'))
        require(end >= start, f'終了時刻が開始より前です: {scene.get("id", "結末")}')
    result = {}
    for page in scene['pages']:
        at = story_time(page['time'], page.get('dayOffset', day), page['key']) if 'time' in page else start
        if 'dayOffset' in page and 'time' not in page:
            require(False, f'日数を指定するページには時刻も必要です: {page["key"]}')
        require(at >= start and (end is None or at <= end), f'場面の時刻範囲を外れています: {page["key"]}')
        result[page['key']] = at
    return result, end


def local_file(base, value):
    require(isinstance(value, str) and value and not Path(value).is_absolute(), f'相対パスが必要です: {value}')
    path = (base / value).resolve()
    require(path.is_relative_to(ROOT), f'プロジェクト外の参照です: {value}')
    require(path.is_file(), f'ファイルがありません: {path}')
    return path


def load_manifest(selection='komorebi'):
    path = Path(selection)
    if not path.exists():
        path = ROOT / 'scenarios' / selection / 'manifest.json'
    elif path.is_dir():
        path /= 'manifest.json'
    path = path.resolve()
    require(path.is_relative_to(ROOT), 'シナリオはプロジェクト内に置いてください')
    manifest = json.loads(path.read_text())
    engine = check_compatibility(manifest)
    require(re.fullmatch(r'[a-z][a-z0-9-]{1,63}', manifest.get('id', '')), 'シナリオIDが不正です')
    package = dict(manifest)
    package['_dir'] = path.parent
    package['_engine'] = engine
    if manifest['id'] != 'komorebi':
        require(not manifest.get('allowLegacySave'), '旧形式の保存は原作専用です')
        package['saveKey'] = f'madoguchi.scenario.{manifest["id"]}.v1'
        package['bestKey'] = f'madoguchi.score.{manifest["id"]}.v1'
    if manifest.get('authoring'):
        source = manifest['authoring']
        metadata = json.loads(local_file(path.parent, source['metadata']).read_text())
        manuscript = local_file(path.parent, source['manuscript'])
        compiled = compile_story(metadata, manuscript.read_text(), str(manuscript))
    else:
        compiled = None
    for key in ['story', 'content', 'assets', 'styles', 'music', 'motion', 'sound']:
        package[key] = compiled if key == 'story' and compiled is not None else json.loads(local_file(path.parent, manifest[key]).read_text())
    package['legacy'] = json.loads(local_file(path.parent, manifest['legacy']).read_text()) if manifest.get('legacy') else {}
    package['moments'] = json.loads(local_file(path.parent, manifest['moments']).read_text()) if manifest.get('moments') else {}
    package['_extensions'] = [local_file(path.parent, name) for name in manifest.get('extensions', [])]
    for source in package['_extensions']:
        require(source.is_relative_to(path.parent), '拡張コードはそのシナリオのフォルダー内に置いてください')
    validate(package)
    return package


def validate(pack):
    check_compatibility(pack, pack.get('_engine'))
    story = pack['story']
    nodes = story['nodes']
    ids = [node['id'] for node in nodes]
    require(ids and len(ids) == len(set(ids)), '場面IDが空、または重複しています')
    blocks = story['blocks']
    require([nid for block in blocks for nid in block['nodes']] == ids, '章の場面一覧と本文の順序が一致しません')
    require(len({b['id'] for b in blocks}) == len(blocks), '章IDが重複しています')
    require(len({b['act'] for b in blocks}) == len(blocks), '章番号が重複しています')
    reserved = {'constructor', 'prototype', '__proto__'}
    def safe_id(value):
        require(isinstance(value, str) and re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_-]*', value) and value not in reserved, f'IDが不正です: {value}')
    for value in ids + [b['id'] for b in blocks]:
        safe_id(value)
    require([b['act'] for b in blocks] == list(range(1, len(blocks)+1)), '章番号は1から順に指定してください')
    all_keys = set()
    decisions, clues, puzzles = [story.get(key, {}) for key in ('decisions', 'clues', 'puzzles')]
    photos = pack['content']['PHOTO_ASSETS']
    choices = {}
    for key in [*decisions, *clues, *puzzles, *story.get('bad_endings', {})]:
        safe_id(key)
    for key, decision in decisions.items():
        require(not decision.get('interaction') or decision['interaction'] == 'counter' and pack.get('_extensions'), f'未対応の応対操作です: {key}')
        options = decision['options']
        choices[key] = [option['id'] for option in options]
        require(len(options) >= 2 and len(set(choices[key])) == len(options), f'選択肢IDが不正です: {key}')
        for option in options:
            safe_id(option['id'])
            if option.get('ending'):
                require(option['ending'] in story.get('bad_endings', {}), f'行き先の結末がありません: {key}/{option["id"]}')
    decision_pages = {}
    for index, node in enumerate(nodes):
        require(node.get('person') in [p['id'] for p in pack['people']], f'視点人物がありません: {node["id"]}')
        require(node.get('block') in [b['id'] for b in blocks] and any(node['id'] in b['nodes'] and b['act'] == node.get('act') and b['id'] == node['block'] for b in blocks), f'場面の章番号が不正です: {node["id"]}')
        require(not node.get('training') or pack.get('_extensions'), '窓口演習には対応する開発者用拡張が必要です')
        require(index == 0 or ids[index-1] in node.get('needs', []), f'直前の場面を前提にしてください: {node["id"]}')
        require(all(dep in ids[:index] for dep in node.get('needs', [])), f'未定義、循環、または後方の前提場面です: {node["id"]}')
        require(node['pages'] or node.get('training'), f'本文が空です: {node["id"]}')
        for page in node['pages']:
            key = page.get('key')
            safe_id(key)
            require(key and key not in all_keys, f'ページIDが空、または重複しています: {key}')
            all_keys.add(key)
            require(isinstance(page.get('text'), str) and page['text'].strip(), f'本文が空です: {key}')
            require(page.get('scene', 'bg') in photos, f'背景がありません: {key}/{page.get("scene")}')
            require(all(k in choices and v in choices[k] for k, v in page.get('when', {}).items()), f'条件が未定義です: {key}')
            require(set(page.get('when', {})) <= decision_pages.keys(), f'まだ選択していない条件です: {key}')
            if page.get('decision'):
                require(not page.get('when'), f'条件付き選択は未対応です: {key}')
                require(page['decision'] in choices, f'選択が未定義です: {key}')
                require(page['decision'] not in decision_pages, f'同じ選択を二度配置しています: {key}')
                decision_pages[page['decision']] = key
            require(all(c in clues for c in page.get('clues', [])), f'手掛かりが未定義です: {key}')
    require(set(decision_pages) == set(decisions), '本文に配置されていない選択があります')
    for key, ending in story.get('bad_endings', {}).items():
        require(ending.get('pages'), f'結末の本文が空です: {key}')
        require(ending.get('node') in ids and ending.get('decision') in decisions, f'結末の戻り先が不正です: {key}')
        retry = next(n for n in nodes if n['id'] == ending['node'])
        require(any(p.get('decision') == ending['decision'] for p in retry['pages']), f'結末の戻り先に選択がありません: {key}')
        require(any(o.get('ending') == key for o in decisions[ending['decision']]['options']), f'結末と選択の対応が不正です: {key}')
        for page in ending['pages']:
            safe_id(page.get('key'))
            require(page['key'] not in all_keys, f'結末のページIDが重複しています: {page["key"]}')
            all_keys.add(page['key'])
            require(isinstance(page.get('text'), str) and page['text'].strip(), f'結末の本文が空です: {key}')
            require(page.get('scene', 'bg') in photos, f'結末の背景がありません: {key}')
            require(not any(page.get(k) for k in ('decision', 'when', 'clues')), f'結末内の分岐・証拠には未対応です: {key}')
    validate_moments(pack, photos)
    review = pack.get('review', {})
    if puzzles:
        require(review.get('after') in ids and review.get('deduction') in ids, '推理画面の前後が未定義です')
        require(ids.index(review['after']) < ids.index(review['deduction']), '推理を始める場面の順序が逆です')
        require([n['id'] for n in nodes if n.get('puzzle')] == [review['deduction']], '推理場面の指定が不正です')
    for key, clue in clues.items():
        require(all(isinstance(clue.get(field), str) and clue[field].strip() for field in ('title', 'who', 'text')), f'手掛かりの説明が不足しています: {key}')
        require(clue.get('node') in ids, f'手掛かりの場面がありません: {key}')
        pages = next(n['pages'] for n in nodes if n['id'] == clue['node'])
        match = next((p for p in pages if p['key'] == clue['pageKey']), None)
        require(match and key in match.get('clues', []), f'手掛かりと本文の対応が不正です: {key}')
        require(pages.index(match) == clue['page'], f'手掛かりのページ番号が古いです: {key}')
    for key, puzzle in puzzles.items():
        require(puzzle['count'] == len(set(puzzle['correct'])), f'根拠の選択数が不正です: {key}')
        require(set(puzzle['correct']) <= set(puzzle['clues']) <= clues.keys(), f'推理の手掛かりが不正です: {key}')
        require(puzzle['answer'] in [o['id'] for o in puzzle['options']], f'推理の正解がありません: {key}')
    # A correct answer must be supported on every non-terminal route before the quiz.
    routes = {key: [o['id'] for o in d['options'] if not o.get('ending')] for key, d in decisions.items()}
    require(all(routes.values()), '通常ルートのない選択があります')
    count = 1
    for values in routes.values():
        count *= len(values)
    require(count <= 512, '分岐が多すぎます。シナリオを分割してください（検証上限512経路）')
    clocks, starts, ends = {}, {}, {}
    for node in nodes:
        day = node.get('dayOffset', 0)
        starts[node['id']] = story_time(node.get('time'), day, node['id'])
        page_times, ends[node['id']] = timed_pages(node, starts[node['id']], day)
        clocks.update(page_times)
    for values in itertools.product(*routes.values()):
        route, seen, chosen = dict(zip(routes, values)), set(), {}
        previous = -1
        for node in nodes:
            require(starts[node['id']] >= previous, f'時刻が逆行しています: {node["id"]}/{route}')
            previous = starts[node['id']]
            if node.get('puzzle'):
                needed = {c for puzzle in puzzles.values() for c in puzzle['correct']}
                require(needed <= seen, f'推理までに必須の根拠が提示されません: {route}, 不足={sorted(needed-seen)}')
            for page in node['pages']:
                require(set(page.get('when', {})) <= chosen.keys(), f'未選択の条件です: {page["key"]}')
                if all(chosen.get(k) == v for k, v in page.get('when', {}).items()):
                    require(clocks[page['key']] >= previous, f'時刻が逆行しています: {page["key"]}/{route}')
                    previous = clocks[page['key']]
                    seen.update(page.get('clues', []))
                    if page.get('decision'):
                        chosen[page['decision']] = route[page['decision']]
            if ends[node['id']] is not None:
                previous = ends[node['id']]
    for key, ending in story.get('bad_endings', {}).items():
        node = next(n for n in nodes if n['id'] == ending['node'])
        previous = clocks[decision_pages[ending['decision']]]
        day = ending.get('dayOffset', node.get('dayOffset', 0))
        start = story_time(ending['time'], day, key) if 'time' in ending else previous
        require(start >= previous, f'時刻が逆行しています: {key}')
        # An ending can extend beyond the scene it branches from.
        page_times, _ = timed_pages(ending, start, day)
        for page in ending['pages']:
            require(page_times[page['key']] >= previous, f'時刻が逆行しています: {page["key"]}')
            previous = page_times[page['key']]
    direction = pack['sound']
    require(set(direction['chapters']) == {b['id'] for b in blocks}, '章のBGM割り当てが不正です')
    require(set(direction['chapters'].values()) | {direction['credits']} <= pack['music'].keys(), 'BGMが未定義です')
    scene_music = direction.get('scenes', {})
    require(isinstance(scene_music, dict), '場面のBGM割り当てはオブジェクトにします')
    require(set(scene_music) <= set(ids), '場面のBGMに指定した場面がありません')
    require(all(isinstance(track, str) and track in pack['music'] for track in scene_music.values()), '場面のBGMが未定義です')
    require('counter' in pack['music'], '通常モードのBGMがありません')
    page_texts = {p['key']: p['text'] for n in nodes for p in n['pages']}
    require(set(direction.get('effects', {})) <= page_texts.keys(), '効果音は通常本文のページに指定してください（結末内は未対応）')
    for key, effect in direction.get('effects', {}).items():
        require(isinstance(effect, str) or isinstance(effect, dict), '効果音は名前または発音位置の指定にします')
        kind = effect if isinstance(effect, str) else effect.get('kind')
        require(isinstance(kind, str) and kind in SCENE_EFFECTS, f'効果音の種類が不正です: {key}/{kind}')
        if isinstance(effect, dict):
            after = effect.get('after')
            marker = re.sub(r'\s+', '', after) if isinstance(after, str) else ''
            require(marker and marker in re.sub(r'\s+', '', page_texts[key]), f'効果音の発音位置が本文にありません: {key}')
    for quiet in direction['silence']:
        require(quiet['node'] in ids, '無音区間の場面がありません')
        keys = [p['key'] for p in next(n['pages'] for n in nodes if n['id'] == quiet['node'])]
        require(quiet['from'] in keys and (not quiet.get('through') or quiet['through'] in keys), '無音区間のページがありません')
        require(not quiet.get('through') or keys.index(quiet['from']) <= keys.index(quiet['through']), '無音区間が逆順です')
    for key, asset in pack['assets'].items():
        path = local_file(pack['_dir'], asset['file'])
        require(asset.get('license') and asset.get('creator'), f'素材の作者・条件がありません: {key}')
        require(hashlib.sha256(path.read_bytes()).hexdigest() == asset['sha256'], f'素材が台帳と異なります: {key}')
    references = set()
    for css in pack['styles'].values():
        references.update(re.findall(r'asset:([a-zA-Z0-9_-]+)', css))
    references.update(t['asset'] for t in pack['music'].values())
    for sizes in pack['motion'].values():
        references.update(sizes.values())
    require(references <= pack['assets'].keys(), f'素材が未定義です: {sorted(references-pack["assets"].keys())}')
    if pack['id'] != 'komorebi':
        require(pack['saveKey'] == f'madoguchi.scenario.{pack["id"]}.v1', '保存先はシナリオIDごとに分離してください')
        require(pack['bestKey'] == f'madoguchi.score.{pack["id"]}.v1', '得点の保存先はシナリオIDごとに分離してください')
    cases = pack['content']['CASES']
    require(len({c['id'] for c in cases}) == len(cases), '窓口ケースIDが重複しています')
    for key, form in pack['content']['FORMS'].items():
        require(form.get('app') and form.get('certs'), f'窓口の申請データが不完全です: {key}')


def validate_moments(pack, photos):
    """Optional visual moments refer to stable pages, never execute authored code."""
    regular = [p for n in pack['story']['nodes'] for p in n['pages']]
    pages = {p['key']: p for p in regular + [p for b in pack['story'].get('bad_endings', {}).values() for p in b['pages']]}
    order = {p['key']: i for i, p in enumerate(regular)}
    moments = pack.get('moments', {})
    require(isinstance(moments, dict), 'momentsはページIDごとのオブジェクトです')
    for key, item in moments.items():
        require(key in pages and isinstance(item, dict), f'演出のページがありません: {key}')
        require(not any(pages[key].get(k) for k in ('decision', 'beat', 'when')), f'演出は通常本文へ配置してください: {key}')
        require(isinstance(item.get('label'), str) and 0 < len(item['label']) <= 80, f'演出の見出しが不正です: {key}')
        kind = item.get('kind')
        require(kind in ('compare', 'photo', 'recall'), f'未対応の演出です: {key}/{kind}')
        if kind == 'photo':
            require(isinstance(item.get('scene'), str) and item['scene'] in photos, f'演出の写真がありません: {key}')
            require(isinstance(item.get('description'), str) and 0 < len(item['description']) <= 300, f'写真の説明が不正です: {key}')
        elif kind == 'compare':
            require(all(isinstance(item.get(k), str) and 0 < len(item[k]) <= 80 for k in ('paperLabel', 'screenLabel')), f'比較資料の見出しが不正です: {key}')
            rows = item.get('rows')
            require(isinstance(rows, list) and 1 <= len(rows) <= 4, f'比較資料は1〜4行です: {key}')
            for row in rows:
                require(isinstance(row, dict) and all(isinstance(row.get(k), str) and 0 < len(row[k]) <= 80 for k in ('label', 'paper', 'screen')), f'比較資料の行が不正です: {key}')
                require(type(row.get('masked', False)) is bool, f'覆いの指定が不正です: {key}')
        else:
            frames = item.get('frames')
            require(key in order and isinstance(frames, list) and 1 <= len(frames) <= 5, f'回想のカット数が不正です: {key}')
            for frame in frames:
                require(isinstance(frame, dict) and isinstance(frame.get('page'), str) and frame['page'] in order and order[frame['page']] < order[key], f'回想は既出の本文を参照してください: {key}')
                source = pages[frame['page']]
                require(not source.get('when'), f'分岐限定のページは共通の回想に使えません: {key}')
                quote = frame.get('quote')
                require(isinstance(quote, str) and 0 < len(quote) <= 120 and quote in source['text'], f'回想の台詞が元の本文にありません: {key}')
                require(type(frame.get('duration')) is int and 2500 <= frame['duration'] <= 10000, f'回想の表示時間が不正です: {key}')


def browser_data(pack):
    return {key: value for key, value in pack.items() if not key.startswith('_') and key != 'extensions'}

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['compile'])
    args, rest = parser.parse_known_args(argv)
    return compile_main(rest)


if __name__ == '__main__':
    sys.exit(main())
