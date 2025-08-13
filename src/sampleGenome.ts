import type { Genome, ChildState } from './types'
export const genome: Genome = {
  "ladders": [
    { "id": "gross_motor.mobility", "domain": "gross_motor", "name": "Mobility", "rootNodeId": "GM-PROP-PRONE-01" },
    { "id": "fine_motor.grasp_release", "domain": "fine_motor", "name": "Grasp & Release", "rootNodeId": "FM-RAKE-01" },
    { "id": "communication.expressive", "domain": "communication_expressive", "name": "Babble -> Words", "rootNodeId": "EX-BABBLE-CANON-01" },
    { "id": "communication.receptive", "domain": "communication_receptive", "name": "Attend & Follow", "rootNodeId": "RC-NAME-ORIENT-01" },
    { "id": "social.joint_attention", "domain": "social_emotional", "name": "Joint Attention", "rootNodeId": "SE-GAZE-SHIFT-01" },
    { "id": "cognition.object_permanence", "domain": "cognition", "name": "Object Permanence", "rootNodeId": "CO-SEARCH-COVER-01" },
    { "id": "self_help.feeding", "domain": "self_help", "name": "Feeding", "rootNodeId": "SH-FINGER-FEED-01" }
  ],
  "nodes": [
    { "id":"GM-PROP-PRONE-01","ladderId":"gross_motor.mobility","domain":"gross_motor","name":"Transitions prone <-> sit","parentId":null,"ageBand":{"typicalStart":8,"typicalEnd":11},"entryCriteria":["Sits independently 60s"],"exitCriteria":["Transitions both directions x3"],"signals":["video.motion_stability","video.posture_change_rate"],"activities":["ACT-GM-TRANSITIONS-01"]},
    { "id":"GM-CRAWL-01","ladderId":"gross_motor.mobility","domain":"gross_motor","name":"Crawls hands & knees 3-5m","parentId":"GM-PROP-PRONE-01","ageBand":{"typicalStart":9,"typicalEnd":12},"exitCriteria":["Crawls 5m on hands & knees x3"],"signals":["video.gait_cycle","video.speed"],"activities":["ACT-GM-TUNNEL-CRAWL"]},
    { "id":"GM-PULL-TO-STAND-01","ladderId":"gross_motor.mobility","domain":"gross_motor","name":"Pulls to stand at support","parentId":"GM-CRAWL-01","ageBand":{"typicalStart":9,"typicalEnd":12},"exitCriteria":["Pull-to-stand at stable surface x3"],"signals":["video.vertical_posture_events"],"activities":["ACT-GM-CRUISE-SETUP"]},
    { "id":"GM-CRUISE-01","ladderId":"gross_motor.mobility","domain":"gross_motor","name":"Cruises sideways holding support","parentId":"GM-PULL-TO-STAND-01","ageBand":{"typicalStart":10,"typicalEnd":13},"exitCriteria":["Cruises 3 steps each direction x2"],"signals":["video.step_count_band"],"activities":["ACT-GM-SOFA-CRUISE"]},
    { "id":"GM-STAND-ALONE-01","ladderId":"gross_motor.mobility","domain":"gross_motor","name":"Stands independently >=3s","parentId":"GM-CRUISE-01","ageBand":{"typicalStart":11,"typicalEnd":14},"exitCriteria":["Unassisted stand 3-5s x3"],"signals":["video.stance_no_support"],"activities":["ACT-GM-STAND-GAME"],"gates":[{"type":"requiresAll","nodes":["SE-GAZE-SHIFT-01"],"minLevel":1.5}]},
    { "id":"GM-FIRST-STEPS-01","ladderId":"gross_motor.mobility","domain":"gross_motor","name":"Takes 1-3 independent steps","parentId":"GM-STAND-ALONE-01","ageBand":{"typicalStart":11,"typicalEnd":15},"exitCriteria":["3 independent steps x2"],"signals":["video.step_detection"],"activities":["ACT-GM-REACH-AND-STEP"]},

    { "id":"FM-RAKE-01","ladderId":"fine_motor.grasp_release","domain":"fine_motor","name":"Raking grasp to pick up pellet","parentId":null,"ageBand":{"typicalStart":7,"typicalEnd":9},"exitCriteria":["Picks pellet with raking grasp x3"],"signals":["video.hand_region_motion"],"activities":["ACT-FM-PELLETS-RAY"]},
    { "id":"FM-INFERIOR-PINCER-01","ladderId":"fine_motor.grasp_release","domain":"fine_motor","name":"Inferior pincer grasp","parentId":"FM-RAKE-01","ageBand":{"typicalStart":9,"typicalEnd":11},"exitCriteria":["Pads of thumb/index grasp pellet x3"],"signals":["video.finger_tip_distance"],"activities":["ACT-FM-PINCER-GAMES"]},
    { "id":"FM-FINE-PINCER-01","ladderId":"fine_motor.grasp_release","domain":"fine_motor","name":"Neat pincer grasp","parentId":"FM-INFERIOR-PINCER-01","ageBand":{"typicalStart":10,"typicalEnd":12},"exitCriteria":["Tips of thumb/index grasp x3"],"signals":["video.pinch_confidence"],"activities":["ACT-FM-STICKER-TRANSFER"]},
    { "id":"FM-RELEASE-CONTAINER-01","ladderId":"fine_motor.grasp_release","domain":"fine_motor","name":"Controlled release into container","parentId":"FM-FINE-PINCER-01","ageBand":{"typicalStart":11,"typicalEnd":14},"exitCriteria":["Drops small object into cup x5"],"signals":["video.release_event"],"activities":["ACT-FM-IN-OUT-CUP"]},

    { "id":"EX-BABBLE-CANON-01","ladderId":"communication.expressive","domain":"communication_expressive","name":"Canonical babble (reduplicated)","parentId":null,"ageBand":{"typicalStart":6,"typicalEnd":10},"exitCriteria":["Consonant-vowel repetition over 10s"],"signals":["audio.canonical_babble_ratio"],"activities":["ACT-EX-BABBLE-CHAT"]},
    { "id":"EX-VARIEGATED-01","ladderId":"communication_expressive","domain":"communication_expressive","name":"Variegated babble (consonant diversity)","parentId":"EX-BABBLE-CANON-01","ageBand":{"typicalStart":9,"typicalEnd":12},"exitCriteria":[">=3 different consonants in 2 min"],"signals":["audio.phoneme_diversity"],"activities":["ACT-EX-SOUND-IMMITATE"]},
    { "id":"EX-FIRST-WORDS-01","ladderId":"communication_expressive","domain":"communication_expressive","name":"First meaningful words (1-3)","parentId":"EX-VARIEGATED-01","ageBand":{"typicalStart":11,"typicalEnd":15},"exitCriteria":["Says 1-3 consistent words"],"signals":["audio.keyword_spots"],"activities":["ACT-EX-NAMING-GAME"],"gates":[{"type":"requiresAll","nodes":["RC-JOINT-ATTEND-01"],"minLevel":1.5}]},

    { "id":"RC-NAME-ORIENT-01","ladderId":"communication_receptive","domain":"communication_receptive","name":"Responds to name","parentId":null,"ageBand":{"typicalStart":7,"typicalEnd":10},"exitCriteria":["Turns head to name >=3/5 trials"],"signals":["audio.call_response_latency"],"activities":["ACT-RC-NAME-GAME"]},
    { "id":"RC-NO-UNDERSTAND-01","ladderId":"communication_receptive","domain":"communication_receptive","name":"Understands 'no' / inhibitory cue","parentId":"RC-NAME-ORIENT-01","ageBand":{"typicalStart":9,"typicalEnd":12},"exitCriteria":["Pauses/looks with inhibitory cue 3/5"],"signals":["video.pause_on_cue"],"activities":["ACT-RC-PAUSE-PLAY"]},
    { "id":"RC-JOINT-ATTEND-01","ladderId":"communication_receptive","domain":"communication_receptive","name":"Follows point/gaze (joint attention)","parentId":"RC-NO-UNDERSTAND-01","ageBand":{"typicalStart":10,"typicalEnd":13},"exitCriteria":["Shifts gaze to target 3/5"],"signals":["video.gaze_shift"],"activities":["ACT-RC-LOOK-POINT"]},

    { "id":"SE-GAZE-SHIFT-01","ladderId":"social.joint_attention","domain":"social_emotional","name":"Alternating gaze (adult <-> object)","parentId":null,"ageBand":{"typicalStart":9,"typicalEnd":12},"exitCriteria":["Alternates gaze twice within 5s"],"signals":["video.face_object_gaze_alternation"],"activities":["ACT-SE-LOOK-SHARE"]},
    { "id":"SE-PROTO-IMPER-01","ladderId":"social.joint_attention","domain":"social_emotional","name":"Points to request","parentId":"SE-GAZE-SHIFT-01","ageBand":{"typicalStart":11,"typicalEnd":14},"exitCriteria":["Index point toward desired object"],"signals":["video.index_extension"],"activities":["ACT-SE-REQUEST-POINT"]},

    { "id":"CO-SEARCH-COVER-01","ladderId":"cognition.object_permanence","domain":"cognition","name":"Finds toy under cloth (visible)","parentId":null,"ageBand":{"typicalStart":8,"typicalEnd":10},"exitCriteria":["Finds under single cover 3/3"],"signals":["video.reach_to_hidden"],"activities":["ACT-CO-PEEKABOO-1"]},
    { "id":"CO-A-NOT-B-RESOLVE-01","ladderId":"cognition.object_permanence","domain":"cognition","name":"Solves A-not-B error","parentId":"CO-SEARCH-COVER-01","ageBand":{"typicalStart":10,"typicalEnd":13},"exitCriteria":["Searches new location B 2/3"],"signals":["video.search_location_switch"],"activities":["ACT-CO-PEEKABOO-2"]},

    { "id":"SH-FINGER-FEED-01","ladderId":"self_help.feeding","domain":"self_help","name":"Finger-feeds small pieces","parentId":null,"ageBand":{"typicalStart":9,"typicalEnd":12},"exitCriteria":["Self-feeds 5 bites"],"signals":["video.hand_to_mouth_rate"],"activities":["ACT-SH-FINGER-PICKUP"]},
    { "id":"SH-CUP-ASSIST-01","ladderId":"self_help.feeding","domain":"self_help","name":"Drinks from open cup with help","parentId":"SH-FINGER-FEED-01","ageBand":{"typicalStart":11,"typicalEnd":14},"exitCriteria":["Sips 3x with minimal spill"],"signals":["video.cup_tilt_events"],"activities":["ACT-SH-CUP-SIP"]}
  ]
};

export function initialChildState(genome: Genome): ChildState {
  const st: ChildState = {}
  for (const n of genome.nodes) {
    st[n.id] = { level: n.parentId ? 0 : 1, confidence: n.parentId ? 0.4 : 0.7, evidence: 0 }
  }
  return st
}
