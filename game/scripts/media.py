#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2026 rtoki
# SPDX-License-Identifier: MIT

"""Optional portrait rendering and encoding tools; use the media-production environment."""
import argparse

def render_family(argv=None):
    from pathlib import Path
    import sys,math,time,json,hashlib,subprocess,argparse
    import cv2,numpy as np,torch,imageio_ffmpeg
    ROOT=Path(__file__).resolve().parents[1]
    ENGINE=ROOT.parent/'tmp/madoguchi-live-portrait'
    sys.path.insert(0,str(ENGINE/'LivePortrait'))
    from src.live_portrait_wrapper import LivePortraitWrapper
    from src.config.inference_config import InferenceConfig
    from src.utils.camera import get_rotation_matrix
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profiles',type=Path,help='JSON crop/body profiles for additional story stills')
    parser.add_argument('--out',type=Path,default=ROOT.parent/'tmp/madoguchi-kurose-broker/story-motion')
    args=parser.parse_args(argv)
    OUT=args.out.resolve();OUT.mkdir(parents=True,exist_ok=True)
    profiles={
     'scene-family-kurose-counter':{'crop':[665,-25,670],'body':[(496,1024),(517,812),(554,668),(612,536),(729,467),(813,441),(835,388),(827,255),(854,127),(937,63),(1060,48),(1144,88),(1191,169),(1190,315),(1154,402),(1280,464),(1350,569),(1415,803),(1445,1024)],'anchor':1005,'center':995},
     'scene-family-daughter':{'crop':[755,-5,530],'body':[(711,923),(737,721),(758,560),(797,447),(895,396),(918,351),(902,251),(909,163),(952,98),(1034,77),(1113,101),(1156,152),(1175,255),(1140,365),(1179,412),(1241,456),(1286,638),(1306,935)],'anchor':930,'center':1030}}
    if args.profiles:profiles=json.loads(args.profiles.read_text())
    torch.set_num_threads(4);cv2.setNumThreads(2)
    model=LivePortraitWrapper(InferenceConfig(flag_use_half_precision=False,flag_force_cpu=not torch.backends.mps.is_available()))
    Y,X=np.mgrid[0:512,0:512].astype(np.float32)
    flow_est=cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    def flow(a,b):
     ga=cv2.cvtColor(cv2.resize(a,(256,256)),cv2.COLOR_RGB2GRAY);gb=cv2.cvtColor(cv2.resize(b,(256,256)),cv2.COLOR_RGB2GRAY)
     return cv2.resize(flow_est.calc(ga,gb,None),(512,512))*2
    for key,profile in profiles.items():
     begun=time.monotonic();source=cv2.cvtColor(cv2.imread(str(ROOT/'images'/f'{key}.png')),cv2.COLOR_BGR2RGB);h,w=source.shape[:2]
     ox,oy,size=profile['crop'];mapping=np.float32([[size/512,0,ox],[0,size/512,oy]])
     crop=cv2.warpAffine(source,cv2.invertAffineTransform(mapping),(512,512),borderMode=cv2.BORDER_REFLECT_101)
     prepared=model.prepare_source(crop);info=model.get_kp_info(prepared);features=model.extract_feature_3d(prepared);kp=model.transform_keypoint(info)
     eye=torch.tensor([[.36,.36,.36]],device=model.device);neutral=model.retarget_eye(kp,eye)
     dist=((X-256)/225)**2+((Y-255)/245)**2;mask=np.clip((1-dist)/.26,0,1);mask=mask*mask*(3-2*mask)
     mask=cv2.warpAffine(mask,mapping,(w,h))[...,None]
     poses={}
     for label,pitch,yaw,gaze,blink in [('rest',0,0,0,False),('right',.2,1.7,.65,False),('left',-.2,-1.5,-.65,False),('nod',2.4,.1,0,False),('blink',0,0,0,True)]:
      exp=info['exp'].clone();exp[0,11,0]+=gaze*.0008;exp[0,15,0]+=gaze*.0008
      rot=get_rotation_matrix(info['pitch']+pitch,info['yaw']+yaw,info['roll']+yaw*.12)
      drive=info['scale'][...,None]*(info['kp']@rot+exp);drive[:,:,:2]+=info['t'][:,None,:2]
      if blink:
       ratio=eye.clone();ratio[0,2]=.012;drive+=model.retarget_eye(kp,ratio)-neutral
      drive=model.stitching(kp,drive);poses[label]=model.parse_output(model.warp_decode(features,kp,drive)['out'])[0]
     cues=[(0,'rest'),(1.1,'right'),(1.8,'rest'),(1.9,'blink'),(2.1,'rest'),(3.4,'nod'),(4.3,'rest'),(5.2,'left'),(6.0,'rest'),(6.1,'blink'),(6.3,'rest'),(8,'rest')]
     flows={(a,b):(flow(poses[a],poses[b]),flow(poses[b],poses[a])) for (_,a),(_,b) in zip(cues,cues[1:]) if a!=b}
     body=np.zeros((h,w),np.float32);cv2.fillPoly(body,[np.array(profile['body'],np.int32)],1);body=cv2.GaussianBlur(body,(0,0),12)
     gy,gx=np.mgrid[0:h,0:w].astype(np.float32);upper=np.clip((profile['anchor']-gy)/700,0,1)
     out=OUT/key;out.mkdir(exist_ok=True)
     writer=imageio_ffmpeg.write_frames(str(out/'motion.mp4'),(1152,768),fps=20,codec='libx264',pix_fmt_in='rgb24',pix_fmt_out='yuv420p',output_params=['-crf','24','-preset','medium','-movflags','+faststart'],macro_block_size=1);writer.send(None)
     for i in range(160):
      t=i/20
      j=next(j for j in range(len(cues)-1) if cues[j][0]<=t<cues[j+1][0]);ta,a=cues[j];tb,b=cues[j+1];u=(t-ta)/(tb-ta)
      if a==b:patch=poses[a]
      else:
       if a!='blink' and b!='blink':u=u*u*(3-2*u)
       f,r=flows[(a,b)];wa=cv2.remap(poses[a],X-u*f[:,:,0],Y-u*f[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101);wb=cv2.remap(poses[b],X-(1-u)*r[:,:,0],Y-(1-u)*r[:,:,1],cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101);patch=cv2.addWeighted(wa,1-u,wb,u,0)
      patch=cv2.warpAffine(patch,mapping,(w,h));full=np.clip(source*(1-mask)+patch*mask,0,255).astype(np.uint8)
      phase=2*math.pi*t/8;angle=math.radians(.38)*math.sin(phase)
      dx=(-(gy-profile['anchor'])*angle+2.0*math.sin(phase)*upper)*body
      dy=((gx-profile['center'])*angle-1.6*(1-math.cos(phase))*upper)*body
      full=cv2.remap(full,gx-dx,gy-dy,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT_101)
      frame=cv2.resize(full,(1152,768),interpolation=cv2.INTER_AREA);writer.send(frame)
      if i in (0,38,68,159):cv2.imwrite(str(out/f'frame-{i}.jpg'),cv2.cvtColor(frame,cv2.COLOR_RGB2BGR))
     writer.close()
     render={'profile':'story-face-body-v1','source':f'images/{key}.png','source_crop':profile['crop'],'method':'5 LivePortrait poses with optical-flow interpolation and a soft foreground body deformation, hands anchored near the desk','device':model.device,'seconds_rendering':round(time.monotonic()-begun,2),'cues':cues}
     (out/'render.json').write_text(json.dumps(render,indent=2)+'\n')
     print('RENDERED',key,render['seconds_rendering'],flush=True)
     manifest_path=ROOT/'motion/manifest.json';manifest=json.loads(manifest_path.read_text());manifest=[e for e in manifest if e['scene']!=key]
     for variant,width,crf in [('mobile',768,26),('desktop',1152,24)]:
      dest=ROOT/'motion'/f'{key}-{variant}.mp4'
      subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(out/'motion.mp4'),'-an','-vf',f'scale={width}:-2','-c:v','libx264','-crf',str(crf),'-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart',str(dest)],check=True)
      data=dest.read_bytes();manifest.append(dict(scene=key,variant=variant,file=str(dest.relative_to(ROOT)),bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),size=[width,width*2//3],fps=20,seconds=8,audio=False,render=render));print(dest.name,len(data),flush=True)
     manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')


def render_conversation(argv=None):
    from pathlib import Path
    import argparse
    import hashlib
    import json
    import math
    import subprocess
    import sys
    import time

    import cv2
    import imageio_ffmpeg
    import numpy as np
    import torch

    ROOT = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(ROOT.parent / 'tmp/madoguchi-live-portrait/LivePortrait'))
    from src.live_portrait_wrapper import LivePortraitWrapper
    from src.config.inference_config import InferenceConfig
    from src.utils.camera import get_rotation_matrix

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profiles', type=Path, default=ROOT / 'motion/story-conversation-profiles.json')
    parser.add_argument('--out', type=Path, default=ROOT.parent / 'tmp/madoguchi-conversation-motion')
    parser.add_argument('--only', help='One scene key to render again after inspection')
    args = parser.parse_args(argv)
    profiles = json.loads(args.profiles.read_text())
    if args.only:
        profiles = {args.only: profiles[args.only]}
    torch.set_num_threads(4)
    cv2.setNumThreads(2)
    model = LivePortraitWrapper(InferenceConfig(flag_use_half_precision=False, flag_force_cpu=not torch.backends.mps.is_available()))
    Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
    flow_est = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM)
    CUES = [(0, 'rest'), (1.1, 'right'), (1.8, 'rest'), (1.9, 'blink'), (2.1, 'rest'), (3.4, 'nod'), (4.3, 'rest'), (5.2, 'left'), (6, 'rest'), (6.1, 'blink'), (6.3, 'rest'), (8, 'rest')]


    def flow(a, b):
        a, b = [cv2.cvtColor(cv2.resize(im, (256, 256)), cv2.COLOR_RGB2GRAY) for im in (a, b)]
        return cv2.resize(flow_est.calc(a, b, None), (512, 512)) * 2


    def polygon(points, w, h, blur):
        mask = np.zeros((h, w), np.float32)
        cv2.fillPoly(mask, [np.array(points, np.int32)], 1)
        return cv2.GaussianBlur(mask, (0, 0), blur)


    def prepare_actor(source, profile):
        h, w = source.shape[:2]
        actor = {'profile': profile, 'body': polygon(profile['body'], w, h, 10)}
        if 'crop' not in profile:
            return actor
        ox, oy, size = profile['crop']
        mapping = np.float32([[size / 512, 0, ox], [0, size / 512, oy]])
        crop = cv2.warpAffine(source, cv2.invertAffineTransform(mapping), (512, 512), borderMode=cv2.BORDER_REFLECT_101)
        prepared = model.prepare_source(crop)
        info = model.get_kp_info(prepared)
        features = model.extract_feature_3d(prepared)
        kp = model.transform_keypoint(info)
        eye = torch.tensor([[.36, .36, .36]], device=model.device)
        neutral = model.retarget_eye(kp, eye)
        dist = ((X - 256) / 225)**2 + ((Y - 255) / 245)**2
        mask = np.clip((1 - dist) / .26, 0, 1)
        mask = cv2.warpAffine(mask * mask * (3 - 2 * mask), mapping, (w, h))
        if profile.get('face'):
            mask *= polygon(profile['face'], w, h, 10)
        poses = {}
        scale = profile.get('pose_scale', 1)
        for label, pitch, yaw, gaze, blink in [('rest', 0, 0, 0, False), ('right', .2, 1.7, .65, False), ('left', -.2, -1.5, -.65, False), ('nod', 2.4, .1, 0, False), ('blink', 0, 0, 0, True)]:
            exp = info['exp'].clone()
            exp[0, 11, 0] += gaze * scale * .0008
            exp[0, 15, 0] += gaze * scale * .0008
            rot = get_rotation_matrix(info['pitch'] + pitch * scale, info['yaw'] + yaw * scale, info['roll'] + yaw * scale * .12)
            drive = info['scale'][..., None] * (info['kp'] @ rot + exp)
            drive[:, :, :2] += info['t'][:, None, :2]
            if blink:
                ratio = eye.clone()
                ratio[0, 2] = .012
                drive += model.retarget_eye(kp, ratio) - neutral
            drive = model.stitching(kp, drive)
            poses[label] = model.parse_output(model.warp_decode(features, kp, drive)['out'])[0]
        flows = {(a, b): (flow(poses[a], poses[b]), flow(poses[b], poses[a])) for (_, a), (_, b) in zip(CUES, CUES[1:]) if a != b}
        actor.update(mapping=mapping, mask=mask[..., None], poses=poses, flows=flows)
        return actor


    def pose_at(actor, t):
        j = next(j for j in range(len(CUES) - 1) if CUES[j][0] <= t < CUES[j + 1][0])
        ta, a = CUES[j]
        tb, b = CUES[j + 1]
        if a == b:
            return actor['poses'][a]
        u = (t - ta) / (tb - ta)
        if 'blink' not in (a, b):
            u = u * u * (3 - 2 * u)
        f, r = actor['flows'][a, b]
        wa = cv2.remap(actor['poses'][a], X - u * f[:, :, 0], Y - u * f[:, :, 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
        wb = cv2.remap(actor['poses'][b], X - (1 - u) * r[:, :, 0], Y - (1 - u) * r[:, :, 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
        return cv2.addWeighted(wa, 1 - u, wb, u, 0)


    for key, scene in profiles.items():
        begun = time.monotonic()
        source_path = ROOT / 'images' / f'{key}.png'
        source = cv2.cvtColor(cv2.imread(str(source_path)), cv2.COLOR_BGR2RGB)
        h, w = source.shape[:2]
        actors = [prepare_actor(source, profile) for profile in scene['actors']]
        gy, gx = np.mgrid[0:h, 0:w].astype(np.float32)
        out = args.out.resolve() / key
        out.mkdir(parents=True, exist_ok=True)
        writer = imageio_ffmpeg.write_frames(str(out / 'motion.mp4'), (1152, 768), fps=20, codec='libx264', pix_fmt_in='rgb24', pix_fmt_out='yuv420p', output_params=['-crf', '24', '-preset', 'medium', '-movflags', '+faststart'], macro_block_size=1)
        writer.send(None)
        for i in range(160):
            t = i / 20
            full = source.copy()
            dx, dy = np.zeros_like(gx), np.zeros_like(gy)
            for actor in actors:
                p = actor['profile']
                at = (t + p.get('phase', 0)) % 8
                if 'poses' in actor:
                    patch = cv2.warpAffine(pose_at(actor, at), actor['mapping'], (w, h))
                    full = np.clip(full * (1 - actor['mask']) + patch * actor['mask'], 0, 255).astype(np.uint8)
                phase = 2 * math.pi * at / 8
                upper = np.clip((p['anchor'] - gy) / 700, 0, 1)
                angle = math.radians(.38) * math.sin(phase) * p.get('sway', 1)
                dx += (np.maximum(p['anchor'] - gy, 0) * angle + 2 * math.sin(phase) * upper * p.get('sway', 1)) * actor['body']
                dy += ((gx - p['center']) * angle - 1.6 * (1 - math.cos(phase)) * upper) * actor['body'] * upper
            full = cv2.remap(full, gx - dx, gy - dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101)
            frame = cv2.resize(full, (1152, 768), interpolation=cv2.INTER_AREA)
            writer.send(frame)
            if i in (0, 38, 68, 122, 159):
                cv2.imwrite(str(out / f'frame-{i}.jpg'), cv2.cvtColor(frame, cv2.COLOR_RGB2BGR))
        writer.close()
        render = {'profile': 'story-conversation-v1', 'source': str(source_path.relative_to(ROOT)), 'profiles': str(args.profiles.resolve().relative_to(ROOT)), 'method': 'Independent LivePortrait face poses and optical-flow interpolation; masked body/hand sway with fixed anchors' if any('poses' in a for a in actors) else 'Masked procedural hand/receiver sway with a fixed arm anchor; no face synthesis', 'device': model.device, 'seconds_rendering': round(time.monotonic() - begun, 2), 'cues': CUES}
        (out / 'render.json').write_text(json.dumps(render, indent=2) + '\n')
        manifest_path = ROOT / 'motion/manifest.json'
        manifest = [entry for entry in json.loads(manifest_path.read_text()) if entry['scene'] != key]
        for variant, width, crf in [('mobile', 768, 26), ('desktop', 1152, 24)]:
            dest = ROOT / 'motion' / f'{key}-{variant}.mp4'
            subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', str(out / 'motion.mp4'), '-an', '-vf', f'scale={width}:-2', '-c:v', 'libx264', '-crf', str(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(dest)], check=True)
            data = dest.read_bytes()
            manifest.append(dict(scene=key, variant=variant, file=str(dest.relative_to(ROOT)), bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), size=[width, width * 2 // 3], fps=20, seconds=8, audio=False, render=render))
            print(dest.name, len(data), flush=True)
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        print('RENDERED', key, render['seconds_rendering'], flush=True)


def encode_mentor(argv=None):
    if argv:
        raise SystemExit('encode-mentor does not accept additional arguments')
    from pathlib import Path
    import hashlib
    import json
    import shutil
    import subprocess
    import imageio_ffmpeg

    root = Path(__file__).resolve().parents[1]
    renders = root.parent / 'tmp/madoguchi-live-portrait/renders'
    out = root / 'motion'
    out.mkdir(exist_ok=True)
    manifest_path = out / 'manifest.json'
    manifest = [v for v in json.loads(manifest_path.read_text()) if v['scene'] not in ('mentor-scene', 'mentor-smile')] if manifest_path.exists() else []
    for key in ('mentor-scene', 'mentor-smile'):
        source = renders / key / 'motion.mp4'
        desktop = out / f'{key}-desktop.mp4'
        mobile = out / f'{key}-mobile.mp4'
        shutil.copy2(source, desktop)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
            '-i', str(source), '-an', '-vf', 'scale=768:512:flags=lanczos,fps=20,tpad=stop_mode=clone:stop_duration=0.1', '-frames:v', '160',
            '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '3.1', '-pix_fmt', 'yuv420p',
            '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', str(mobile)], check=True)
        for variant, path, size, fps in [('desktop', desktop, [1152, 768], 25), ('mobile', mobile, [768, 512], 20)]:
            data = path.read_bytes()
            assert data.find(b'moov') < data.find(b'mdat'), 'faststart required'
            entry = {'scene': key, 'variant': variant, 'file': str(path.relative_to(root)),
                'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                'size': size, 'fps': fps, 'seconds': 8, 'audio': False,
                'source': str(source.relative_to(root.parent)),
                'render': json.loads((renders / key / 'render.json').read_text())}
            manifest.append(entry)
            print(f'{key} {variant}: {len(data):,} bytes, {size[0]}x{size[1]}, {fps}fps')
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


def encode_cast(argv=None):
    from pathlib import Path
    import argparse, hashlib, json, shutil, subprocess
    import imageio_ffmpeg

    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument('--characters', default=','.join(f'c{i}' for i in range(1, 15)))
    args = parser.parse_args(argv)
    keys = [f'{person}-{cell}' for person in args.characters.split(',') for cell in range(4)]
    renders = root.parent / 'tmp/madoguchi-live-portrait/cast-renders'
    out = root / 'motion'
    manifest = [v for v in json.loads((out / 'manifest.json').read_text()) if v['scene'] not in keys]
    for key in keys:
        source = renders / key / 'motion.mp4'
        metadata = json.loads((renders / key / 'render.json').read_text())
        desktop, mobile = [out / f'{key}-{variant}.mp4' for variant in ['desktop', 'mobile']]
        shutil.copyfile(source, desktop)
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y',
            '-i', str(source), '-an', '-vf', 'scale=320:480:flags=lanczos', '-frames:v', '160',
            '-c:v', 'libx264', '-profile:v', 'main', '-level:v', '3.1', '-pix_fmt', 'yuv420p',
            '-crf', '24', '-preset', 'slow', '-movflags', '+faststart', str(mobile)], check=True)
        for variant, path, size in [('desktop', desktop, [512, 768]), ('mobile', mobile, [320, 480])]:
            data = path.read_bytes()
            assert data.find(b'moov') < data.find(b'mdat'), 'faststart required'
            assert len(data) < (200_000 if variant == 'mobile' else 450_000), path
            manifest.append({'scene': key, 'variant': variant, 'file': str(path.relative_to(root)),
                'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'size': size,
                'fps': 20, 'seconds': 8, 'audio': False, 'source': str(source.relative_to(root.parent)), 'render': metadata})
        print(f'{key}: desktop {desktop.stat().st_size:,} B; mobile {mobile.stat().st_size:,} B', flush=True)
    (out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['render-family', 'render-conversation', 'encode-mentor', 'encode-cast'])
    args, rest = parser.parse_known_args(argv)
    operations = {'render-family': render_family, 'render-conversation': render_conversation,
                  'encode-mentor': encode_mentor, 'encode-cast': encode_cast}
    operations[args.command](rest)


if __name__ == '__main__':
    main()
