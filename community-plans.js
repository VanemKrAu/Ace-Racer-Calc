/**
 * 王牌竞速芯片计算器 · 社区与本地方案库系统
 * community-plans.js (v2.2 深度重构版)
 * 
 * 核心架构与设计规范：
 * 1. 【第 0 号最高复用准则】：能复用网站已有组件的一律 100% 直接复用，严禁自创莫名其妙的 UI
 *    - 主卡片直接使用宿主原生 `.card`，继承半透明玻璃底色、180°渐变与 `--surface-rim` 高光
 *    - 排序下拉彻底废弃原生 `<select>`，100% 采用全站 `.dropdown-container` / `.dropdown-menu`
 *    - 分段切换 100% 采用全站 `.chip-seg`
 *    - 内部方案卡片 100% 对齐全站 `.chip-tile` 毛玻璃悬浮微浮动体系
 * 2. 挂载位置：严格挂载于「选择赛车」卡片 (.desktop-layout.cp-hero) 正下方
 * 3. 国服最强标志：采用游戏内官方提取的高清黑面罩冰晶头盔 (data/icon/pro_helmet_m.png)
 * 4. 健壮性与物理阻断：PlanValidator 代码层零成本阻断垃圾信息；团魂不拦截且提示精准具体
 * 5. 零 emoji，全量规范线性 SVG (stroke="currentColor", class="ico")
 * 6. UI 多端适配：手机端 (≤640px)、平板端 (641px~1024px)、PC 端 (≥1025px) 自适应响应式
 */

(function (window, document) {
  'use strict';

  // 存储键名常量
  var STORAGE_KEYS = {
    PLANS: 'arc_saved_plans_v1',
    DRAFT: 'arc_draft_v1',
    VOTES: 'arc_voted_plans_v1',
    CLIENT_ID: 'arc_client_id_v1',
    DEVICE_FP: 'arc_device_fp_v1',
    SETTINGS: 'arc_user_settings_v1',
    AUTO_DRAFT: 'arc_auto_draft_enabled',
    ANNOUNCEMENT_STATE: 'arc_announcement_state_v1',
    NOTIFICATIONS: 'arc_notifications_v1'
  };

  // Cloudflare Turnstile 公开 Site Key（仅用于前端渲染托管人机校验框，非密钥）
  var TURNSTILE_SITE_KEY = '0x4AAAAAAF_MFEXcXJElnxKc';
  var TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  // 赋能键名 -> 人类可读中文兜底映射表（优先从 window.TALENTS_DATA 实时读取）
  var EMP_FALLBACK_MAP = {
    yichu: '拒绝溢出',
    fusu: '复苏之泉',
    jiezou: '节奏赋能',
    queyi: '缺一不可',
    weilai: '未来视界',
    huaxin: '花信风',
    huishou: '能源回收',
    duanwei: '断位赋能',
    chaohe: '超核赋能'
  };

  function resolveEmpowerLabel(empKey) {
    var k = String(empKey || '').trim();
    if (!k) return '';
    var list = window.TALENTS_DATA;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (t && (t.key === k || String(t.id) === k)) {
          return t.name || t.nameEn || k;
        }
      }
    }
    return EMP_FALLBACK_MAP[k] || k;
  }

  function formatEmpsText(empArr) {
    if (!Array.isArray(empArr) || empArr.length === 0) return '';
    return empArr.map(resolveEmpowerLabel).filter(Boolean).join(' · ');
  }

  var DEVICE_LABEL_MAP = {
    loop: '循环装置',
    chg: '充能装置',
    schg: '超级充能装置',
    acc: '加速装置'
  };

  var CHIP_NAME_MAP = {
    acecore: '王牌核心',
    hunter: '隐匿猎手之芯',
    catnap: '猫眠梦之芯',
    hardman: '超频：硬汉模式',
    triple: '超频：三重推进',
    qinglong: '至尊：翔宇青龙',
    aomei: '墨染：傲梅',
    xiuzhu: '墨染：修竹',
    yiju: '墨染：逸菊',
    xiuhua: '至美：羞花'
  };

  var OFFICIAL_CHIP_META = {
    '1': {"name":"动力I","kind":"normal","shape":"○","desc":"极速 0.4","iconFile":"chip_icon_dl_1_1.png"},
    '2': {"name":"守护I","kind":"normal","shape":"○","desc":"耐久 5","iconFile":"chip_icon_sh_1_1.png"},
    '3': {"name":"急先锋I","kind":"normal","shape":"△","desc":"起步推进 0.83秒","iconFile":"chip_icon_xf_2_1.png"},
    '4': {"name":"跃动I","kind":"normal","shape":"△","desc":"涡轮连发 15%","iconFile":"chip_icon_yd_2_1.png"},
    '5': {"name":"节气I","kind":"normal","shape":"△","desc":"氮气时间 5.3%","iconFile":"chip_icon_jq_2_1.png"},
    '6': {"name":"滑流I","kind":"normal","shape":"◇","desc":"尾流集氮 9.3%","iconFile":"chip_icon_hl_3_1.png"},
    '7': {"name":"蓄氮I","kind":"normal","shape":"◇","desc":"漂移集氮 2%","iconFile":"chip_icon_xd_3_1.png"},
    '8': {"name":"汇能I","kind":"normal","shape":"◇","desc":"汇能 3%","iconFile":"chip_icon_hn_3_1.png"},
    '9': {"name":"团魂I","kind":"normal","shape":"◇","desc":"团魂 12%","iconFile":"chip_icon_th_3_1.png"},
    '10': {"name":"背水I","kind":"normal","shape":"⬡","desc":"背水 1.6","iconFile":"chip_icon_bs_4_1.png"},
    '11': {"name":"逆流I","kind":"normal","shape":"⬡","desc":"尾流提速 2.4","iconFile":"chip_icon_nl_4_1.png"},
    '12': {"name":"进境I","kind":"normal","shape":"⬡","desc":"进境 0.45","iconFile":"chip_icon_jj_4_1.png"},
    '13': {"name":"反击I","kind":"normal","shape":"⬡","desc":"反击 1","iconFile":"chip_icon_fj_4_1.png"},
    '14': {"name":"先制I","kind":"normal","shape":"⬡","desc":"先制 0.5","iconFile":"chip_icon_xz_4_1.png"},
    '15': {"name":"反制I","kind":"normal","shape":"⬡","desc":"反制 1.67%","iconFile":"chip_icon_fz_4_1.png"},
    '16': {"name":"先机I","kind":"normal","shape":"◇","desc":"先机 5%","iconFile":"chip_icon_xj_3_1.png"},
    '101': {"name":"专业领航","kind":"track","shape":"V","desc":"领航员得分 50%"},
    '201': {"name":"记忆：龙井问茶","kind":"track","shape":"V","desc":"龙井问茶赛道，极速 3"},
    '202': {"name":"记忆：山城飞行","kind":"track","shape":"V","desc":"山城飞行赛道，极速 3"},
    '203': {"name":"记忆：跃动苏堤","kind":"track","shape":"V","desc":"跃动苏堤赛道，极速 3"},
    '204': {"name":"记忆：通天大道","kind":"track","shape":"V","desc":"通天大道赛道，极速 3"},
    '205': {"name":"记忆：榛名山","kind":"track","shape":"V","desc":"榛名山赛道，极速 3"},
    '206': {"name":"记忆：天堑之桥","kind":"track","shape":"V","desc":"天堑之桥赛道，极速 3"},
    '207': {"name":"记忆：日月同辉","kind":"track","shape":"V","desc":"日月同辉赛道，极速 3"},
    '208': {"name":"记忆：雅丹拉力","kind":"track","shape":"V","desc":"雅丹拉力赛道，极速 3"},
    '209': {"name":"记忆：虹桥练习场","kind":"track","shape":"V","desc":"虹桥练习场中，极速 3"},
    '210': {"name":"记忆：英雄之路","kind":"track","shape":"V","desc":"英雄之路赛道，极速 3"},
    '211': {"name":"记忆：立交夜驰","kind":"track","shape":"V","desc":"立交夜驰赛道，极速 3"},
    '212': {"name":"记忆：凌云栈道","kind":"track","shape":"V","desc":"凌云栈道赛道，极速 3"},
    '213': {"name":"记忆：乡村小镇","kind":"track","shape":"V","desc":"乡村小镇赛道，极速 3"},
    '214': {"name":"记忆：极地拉力","kind":"track","shape":"V","desc":"极地拉力赛道，极速 3"},
    '215': {"name":"记忆：峡谷纵横","kind":"track","shape":"V","desc":"峡谷纵横赛道，极速 3"},
    '216': {"name":"记忆：午夜霓虹","kind":"track","shape":"V","desc":"午夜霓虹赛道，极速 3"},
    '217': {"name":"记忆：海岸风暴","kind":"track","shape":"V","desc":"海岸风暴赛道，极速 3"},
    '218': {"name":"记忆：千本鸟居","kind":"track","shape":"V","desc":"千本鸟居赛道，极速 3"},
    '219': {"name":"记忆：65号公路","kind":"track","shape":"V","desc":"65号公路赛道，极速 3"},
    '220': {"name":"记忆：水坝疾行","kind":"track","shape":"V","desc":"水坝疾行赛道，极速 3"},
    '221': {"name":"记忆：速度节赛车场","kind":"track","shape":"V","desc":"速度节赛车场，极速 3"},
    '222': {"name":"记忆：沙洲腹地","kind":"track","shape":"V","desc":"沙洲腹地赛道，极速 3"},
    '223': {"name":"记忆：金手指训练场","kind":"track","shape":"V","desc":"金手指训练场，极速 3"},
    '224': {"name":"记忆：通云九钧","kind":"track","shape":"V","desc":"通云九钧赛道，极速 3"},
    '225': {"name":"记忆：枫落过隙","kind":"track","shape":"V","desc":"枫落过隙赛道，极速 3"},
    '226': {"name":"记忆：海岛果岭","kind":"track","shape":"V","desc":"海岛果岭赛道，极速 3"},
    '227': {"name":"记忆：旷野惊风","kind":"track","shape":"V","desc":"旷野惊风赛道，极速 3"},
    '228': {"name":"记忆：失落的神庙","kind":"track","shape":"V","desc":"迷宫赛道，极速 3"},
    '229': {"name":"记忆：王牌学院","kind":"track","shape":"V","desc":"王牌学院赛道，极速 3"},
    '230': {"name":"记忆：层楼千落","kind":"track","shape":"V","desc":"层楼千落赛道，极速 3"},
    '231': {"name":"记忆：停车楼","kind":"track","shape":"V","desc":"停车楼赛道，极速 3"},
    '232': {"name":"记忆：318国道","kind":"track","shape":"V","desc":"318国道赛道，极速 3"},
    '233': {"name":"记忆：红牛极限工厂","kind":"track","shape":"V","desc":"红牛极限工厂赛道，极速 3"},
    '234': {"name":"记忆：烟雨江南","kind":"track","shape":"V","desc":"烟雨江南赛道，极速 3"},
    '235': {"name":"记忆：樱之峠","kind":"track","shape":"V","desc":"樱之峠赛道，极速 3"},
    '301': {"name":"真实阵营","kind":"track","shape":"V","desc":"比赛中不少于3台真实车辆时，极速 3"},
    '302': {"name":"幻想阵营","kind":"track","shape":"V","desc":"比赛中不少于3台幻想车辆时，极速 3"},
    '1001': {"name":"增幅装置·○","kind":"core","shape":"V","desc":"圆形扩展芯片性能 50%","iconFile":"chip_icon_zfxp_1_4.png"},
    '1002': {"name":"增幅装置·△","kind":"core","shape":"V","desc":"三角形扩展芯片性能 50%","iconFile":"chip_icon_zfxp_2_4.png"},
    '1003': {"name":"增幅装置·◇","kind":"core","shape":"V","desc":"菱形扩展芯片性能 50%","iconFile":"chip_icon_zfxp_3_4.png"},
    '1004': {"name":"增幅装置·⑥","kind":"core","shape":"V","desc":"六边形扩展芯片性能 50%","iconFile":"chip_icon_zfxp_4_4.png"},
    '1005': {"name":"外部充能核心","kind":"core","shape":"V","desc":"大招提供团队充能 30%","iconFile":"chip_icon_cnhx_cnhx_4.png"},
    '1006': {"name":"自律核心","kind":"core","shape":"V","desc":"大招命中时获得充能 20%","iconFile":"chip_icon_zlhx_zlhx_4.png"},
    '1007': {"name":"加速核心","kind":"core","shape":"V","desc":"每次点击大招后，下一次氮气期间极速20km/h（次数可存储）","iconFile":"chip_icon_jshx_jshx_4.png"},
    '1008': {"name":"氮气出弯","kind":"core","shape":"V","desc":"氮气速度3km/h，触发氮气出弯时立即退出漂移","iconFile":"chip_icon_dqcw_dqcw_4.png"},
    '1009': {"name":"无界核心","kind":"core","shape":"V","desc":"获得集气无阈值效果，漂移集气效率10%"},
    '1010': {"name":"涡轮核心","kind":"core","shape":"V","desc":"每2次使用涡轮时获得一个涡轮，每次使用涡轮后2秒内极速+1km/h，加速期间重复使用涡轮时，加速时间将会刷新且加速翻倍（上限8km/h）"},
    '1011': {"name":"穿透核心","kind":"core","shape":"V","desc":"开局5秒时获得15%大招能量并使下次干扰效果必定命中"},
    '1012': {"name":"王牌核心","kind":"core","shape":"核心","desc":"每次点击大招时立即结束漂移状态并获得5%大招能量","calcId":"acecore"},
    '2001': {"name":"超频：刀片跑法","kind":"exclusive","shape":"V","desc":"特技期间每次超车获得3000氮气能量","iconFile":"chip_icon_dppf_dppf_4.png"},
    '2002': {"name":"超频：双闪","kind":"exclusive","shape":"V","desc":"每次闪现后获得3秒氮气加速效果","iconFile":"chip_icon_ssqh_ssqh_4.png"},
    '2003': {"name":"超频：硬汉模式","kind":"exclusive","shape":"V","desc":"若冲锋期间未撞击到其他车辆，大招结束时恢复45%大招能量","calcId":"hardman","iconFile":"chip_icon_yhms_yhms_4.png"},
    '2004': {"name":"超频：人车合一","kind":"exclusive","shape":"V","desc":"释放人车合一时获得5.25秒隐身效果","iconFile":"chip_icon_rchy_rchy_4.png"},
    '2005': {"name":"超频：龙卷冲锋","kind":"exclusive","shape":"V","desc":"龙卷冲锋的旋转速度提升60%","iconFile":"chip_icon_ljcf_ljcf_4.png"},
    '2006': {"name":"超频：纳米科技","kind":"exclusive","shape":"V","desc":"大招充能范围从50米提升至300米，距离超过50米的队友受到的充能效果会有一定衰减","iconFile":"chip_icon_nmkj_nmkj_4.png"},
    '2007': {"name":"超频：三重推进","kind":"exclusive","shape":"V","desc":"每次点击大招自充能10%","calcId":"triple","iconFile":"chip_icon_sctj_sctj_4.png"},
    '2008': {"name":"超频：空中巡航","kind":"exclusive","shape":"V","desc":"空中巡航期间，每秒刷出一个涡轮及获得750氮气充能","iconFile":"chip_icon_kzxh_kzxh_4.png"},
    '2009': {"name":"超频：漆黑魅影","kind":"exclusive","shape":"V","desc":"干扰前方敌人转换为干扰400米范围内敌人","iconFile":"chip_icon_qhmy_qhmy_4.png"},
    '2010': {"name":"超频：时空穿梭","kind":"exclusive","shape":"V","desc":"穿梭结束后进行3秒可取消的自动导航","iconFile":"chip_icon_csscp_csscp_4.png"},
    '2011': {"name":"至尊：翔宇青龙","kind":"exclusive","shape":"V","desc":"比赛完成时间不会增加，开局时获得13%大招能量，每15秒使本局比赛完成时间-0.3秒，比赛结束倒计时变为13秒","calcId":"qinglong"},
    '2012': {"name":"至尊：浴火朱雀","kind":"exclusive","shape":"V","desc":"每秒自动获得400集气量，向前闪现距离33%"},
    '2013': {"name":"至尊：啸风白虎","kind":"exclusive","shape":"V","desc":"开局时获得8000集气量，辅助范围提升至700米"},
    '2014': {"name":"至尊：镇渊玄武","kind":"exclusive","shape":"V","desc":"曼巴蛇在前方60米处召唤且移动速度提升至250km/h，获得集气无阈值效果"},
    '2015': {"name":"墨染：傲梅","kind":"exclusive","shape":"V","desc":"干扰范围变为120米，充能效率提升5%，每次使用大招时获得3500集气量并将涡轮和氮气染色6秒","calcId":"aomei"},
    '2016': {"name":"墨染：幽兰","kind":"exclusive","shape":"V","desc":"开局8秒时补齐未解锁的圣印，开局25秒后，每2次大招结束时触发已解锁的圣印效果"},
    '2017': {"name":"墨染：修竹","kind":"exclusive","shape":"V","desc":"舍我其谁达到80%能量即可使用，每次被干扰和辅助时立即获得1200集气量（CD2秒）","calcId":"xiuzhu"},
    '2018': {"name":"墨染：逸菊","kind":"exclusive","shape":"V","desc":"自动集气翻倍，极速+13km/h，耐久损失降低12%，能量损失和消耗降低40%","calcId":"yiju"},
    '2019': {"name":"至美：羞花","kind":"exclusive","shape":"V","desc":"大招能量达到88%即可使用，开局时获得25%大招能量，所有陷阱触发次数要求降低2次，陷阱获得的增益效果加成50%","calcId":"xiuhua"},
    '2020': {"name":"反弹极速","kind":"exclusive","shape":"V","desc":"充能效率10%，每次使用大招时和成功反弹干扰效果时本局内极速+3km/h（上限叠加5次）并获得2500集气量"},
    '2021': {"name":"开局万集","kind":"exclusive","shape":"V","desc":"开局时获得10000集气量，辅助范围变为700米"},
    '2022': {"name":"大招返能","kind":"exclusive","shape":"V","desc":"每次使用大招时损失20%当前大招能量，每次大招结束时获得24%大招能量"},
    '3001': {"name":"修炼：神速","kind":"boost","shape":"V","desc":"每3次使用氮气，本局内极速2.3km/h，上限叠加3次","iconFile":"chip_icon_ssxp_ssxp_4.png"},
    '3002': {"name":"修炼：冲刺","kind":"boost","shape":"V","desc":"向前闪现距离20%","iconFile":"chip_icon_ccxp_ccxp_4.png"},
    '3003': {"name":"修炼：累积","kind":"boost","shape":"V","desc":"每5次点击大招时获得5000集气量且本局内极速5km/h，上限叠加4次","iconFile":"chip_icon_ljxp_ljxp_4.png"},
    '3004': {"name":"修炼：追击","kind":"boost","shape":"V","desc":"处于第4名及以后名次时，极速8km/h","iconFile":"chip_icon_zjxp_zjxp_4.png"},
    '3005': {"name":"修炼：飞驰","kind":"boost","shape":"V","desc":"开局前45秒内，极速8km/h","iconFile":"chip_icon_fcxp_fcxp_4.png"},
    '3006': {"name":"修炼：突进","kind":"boost","shape":"V","desc":"开局首次使用氮气时附加50米闪现效果","iconFile":"chip_icon_tjxp_tjxp_4.png"},
    '3007': {"name":"修炼：坚韧","kind":"boost","shape":"V","desc":"开局时和每11秒极速1.7km/h，上限叠加5次","iconFile":"chip_icon_jrxp_jrxp_4.png"},
    '3008': {"name":"修炼：效率","kind":"boost","shape":"V","desc":"开局前25秒内极速+5km/h并获得集气无阈值效果"},
    '4001': {"name":"圣骑士之芯","kind":"exclusive","shape":"V","desc":"使用大招后5秒内将蓝色涡轮和氮气变为紫色涡轮和氮气，每4次使用涡轮、氮气或大招极速3km/h，上限叠加3次"},
    '4002': {"name":"神剑号之芯","kind":"exclusive","shape":"V","desc":"每次点击大招时立即结束漂移状态，开局前33秒内获得集气无阈值效果且每次点击大招时获得900集气量"},
    '4003': {"name":"猫眠梦之芯","kind":"exclusive","shape":"V","desc":"每6秒获得1200集气量并恢复6点耐久值，大招达到90%能量即可使用（猫眠梦装备时改为66%）","calcId":"catnap"},
    '4004': {"name":"隐匿猎手之芯","kind":"exclusive","shape":"V","desc":"极速18km/h但每次使用涡轮-0.5km/h（上限减少30次，加速不会被驱散，减速无法净化），每2次使用大招时充能16%（隐匿猎手装备时同时清空芯片减速）","calcId":"hunter"},
    '4005': {"name":"缩减赛时","kind":"exclusive","shape":"V","desc":"完成比赛时间-1秒，收到的辅助能量加成20%（烛龙装备时变为30%）。"}
  };

  var OFFICIAL_TIER_OPTIONS = [
    { key: '16-99', label: '车神高分', shortLabel: '16-99段' },
    { key: '10-15', label: '进阶排位', shortLabel: '10-15段' },
    { key: '1-9', label: '入门参考', shortLabel: '1-9段' }
  ];

  function getOfficialChipInfo(chipId) {
    var id = String(chipId);
    if (OFFICIAL_CHIP_META[id]) return OFFICIAL_CHIP_META[id];
    var num = parseInt(id, 10);
    if (num >= 200 && num < 300) return { name: '赛道专属 #' + id, kind: 'normal', shape: '○', desc: '特定赛道极速芯片' };
    if (num >= 2000 && num < 3000) return { name: '专属核心 #' + id, kind: 'exclusive', shape: 'V', desc: '车辆专属核心芯片' };
    if (num >= 3000 && num < 4000) return { name: '增幅核心 #' + id, kind: 'boost', shape: 'V', desc: '增幅核心芯片' };
    if (num >= 4000 && num < 5000) return { name: '至尊核心 #' + id, kind: 'exclusive', shape: 'V', desc: '至尊/至美核心芯片' };
    return { name: '芯片 #' + id, kind: 'normal', shape: '', desc: '' };
  }

  function countCarSlotShapes(car) {
    var counts = { diamond: 0, triangle: 0, hex: 0, circle: 0 };
    var slots = (car && car.chip_slots) ? String(car.chip_slots) : '';
    for (var i = 0; i < slots.length; i++) {
      var ch = slots[i];
      if (ch === '\u25C7') counts.diamond++;
      else if (ch === '\u25B3') counts.triangle++;
      else if (ch === '\u25E3') counts.hex++;
      else if (ch === '\u25CB') counts.circle++;
    }
    return counts;
  }

  function buildOfficialDerivedParams(tierWeights, car, curMode) {
    var base = ParamsIO.capture();
    var weights = tierWeights || {};
    var shapes = countCarSlotShapes(car);
    // ailab 权重键与真实芯片 ID 对齐：8 汇能I、16 先机I、9 团魂I；
    // 1002 增幅装置·△、1003 增幅装置·◇、1004 增幅装置·⑥
    // 所有核心芯片共用一个核心槽，官方推荐按权重选一个，避免王牌核心与增幅同时生效。
    var coreId = '';
    var coreWeight = 0;
    for (var coreNum = 1001; coreNum <= 1012; coreNum++) {
      var candidate = String(coreNum), weight = Number(weights[candidate]) || 0;
      if (weight >= 0.2 && weight > coreWeight) { coreId = candidate; coreWeight = weight; }
    }
    var boostDiamond = coreId === '1003' && coreWeight >= 0.35;
    var boostTriangle = coreId === '1002' && coreWeight >= 0.35;
    var boostHex = coreId === '1004' && coreWeight >= 0.35;

    var wHuineng = Number(weights['8']) || 0;
    var wXianji = Number(weights['16']) || 0;
    var wTuanhun = Number(weights['9']) || 0;

    // 1. 估算先机：菱形槽位每颗满级 7.5%（带菱形扩展 11.25%）
    var xianjiStep = boostDiamond ? 11.25 : 7.5;
    var maxXianjiBySlot = Math.min(30, shapes.diamond * xianjiStep);
    var estXianji = 0;
    if (wXianji >= 0.12 && shapes.diamond > 0) {
      var estDiamondXianji = Math.max(1, Math.min(shapes.diamond, Math.round(wXianji * 1.5)));
      estXianji = Number(Math.min(maxXianjiBySlot, estDiamondXianji * xianjiStep).toFixed(2));
    }

    // 2. 估算汇能：三角/六边形每颗 9%（扩展 13.5%），剩余菱形每颗 18%（扩展 27%）
    var usedDiamonds = Math.min(shapes.diamond, Math.round(estXianji / xianjiStep));
    var freeDiamonds = Math.max(0, shapes.diamond - usedDiamonds);
    var maxHuinengBySlot = freeDiamonds * (boostDiamond ? 27 : 18) +
      shapes.triangle * (boostTriangle ? 13.5 : 9) +
      shapes.hex * (boostHex ? 13.5 : 9);
    var estHuineng = 0;
    if (wHuineng >= 0.12 && maxHuinengBySlot > 0) {
      // 汇能权重通常落在 0.2 ~ 2.5，按权重估算推荐占比
      var ratio = Math.min(1, Math.max(0.25, wHuineng / 1.8));
      var rawHuineng = maxHuinengBySlot * ratio;
      estHuineng = Number(Math.min(maxHuinengBySlot, Math.max(9, Math.round(rawHuineng * 2) / 2)).toFixed(1));
    }

    // 3. 估算团魂（仅团魂获能模式适用）
    var estTuanhun = base.tuanhun || 0;
    if (curMode === 'team' && wTuanhun >= 0.12 && shapes.diamond > 0) {
      var thStep = boostDiamond ? 24 : 16;
      var thSlots = Math.max(1, Math.min(shapes.diamond, Math.round(wTuanhun * 1.5)));
      estTuanhun = Math.min(200, thSlots * thStep);
    }

    // 4. 匹配计算器内已支持的特殊核心芯片（仅保留当前车可装备的）
    var matchedChips = [];
    Object.keys(weights).forEach(function (cid) {
      var w = Number(weights[cid]) || 0;
      if (w < 0.2) return;
      var meta = OFFICIAL_CHIP_META[cid];
      if (!meta || !meta.calcId) return;
      if (meta.kind === 'core' && cid !== coreId) return;
      var def = typeof window._chipDef === 'function' ? window._chipDef(meta.calcId) : null;
      if (!def) return;
      if (typeof def.canEquip === 'function' && car && !def.canEquip(car)) return;
      matchedChips.push({ id: meta.calcId, weight: w, opts: { loopMode: 'peak' } });
    });
    matchedChips.sort(function (a, b) { return b.weight - a.weight; });
    var maxVSlots = (typeof window.getCarVSlots === 'function' && car) ? window.getCarVSlots(car) : 2;
    var pickedCore = false, pickedV = 0;
    var chipsOn = matchedChips.filter(function (c) {
      var def = typeof window._chipDef === 'function' ? window._chipDef(c.id) : null;
      if (def && def.slotType === 'core') {
        if (pickedCore) return false;
        pickedCore = true;
        return true;
      }
      if (pickedV >= maxVSlots) return false;
      pickedV++;
      return true;
    }).map(function (c) {
      return { id: c.id, opts: c.opts };
    });

    var outParams = Object.assign({}, base, {
      xianji: estXianji,
      huineng: estHuineng
    });
    if (curMode === 'team') {
      outParams.tuanhun = estTuanhun;
    }
    outParams.chips_on = chipsOn;
    return {
      params: outParams,
      xianji: estXianji,
      huineng: estHuineng,
      tuanhun: estTuanhun,
      chipsOn: chipsOn
    };
  }

  function fmtPlanNum(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return String(Number(n.toFixed(2)));
  }

  function formatChipsList(p) {
    var out = [];
    if (Array.isArray(p.chips_on) && p.chips_on.length > 0) {
      p.chips_on.forEach(function (c) {
        if (!c) return;
        var id = typeof c === 'object' ? String(c.id || '') : String(c);
        if (!id) return;
        var def = typeof window._chipDef === 'function' ? window._chipDef(id) : null;
        var cname = (def && def.name && (def.name.zh || def.name.en)) || CHIP_NAME_MAP[id] || id;
        var optLabels = [];
        if (c && typeof c === 'object' && c.opts && typeof c.opts === 'object') {
          var optDefs = (def && typeof window._chipOptionDefs === 'function') ? window._chipOptionDefs(def) : [];
          Object.keys(c.opts).forEach(function (k) {
            var val = c.opts[k];
            if (val === undefined || val === null || val === '') return;
            var matchedText = '';
            for (var i = 0; i < optDefs.length; i++) {
              if (optDefs[i].id === k && Array.isArray(optDefs[i].choices)) {
                for (var j = 0; j < optDefs[i].choices.length; j++) {
                  if (String(optDefs[i].choices[j].v) === String(val)) {
                    matchedText = optDefs[i].choices[j].zh || optDefs[i].choices[j].en || String(val);
                    break;
                  }
                }
              }
            }
            if (!matchedText && k === 'loopMode') {
              matchedText = val === 'safe' ? '稳妥循环+0%' : (val === 'peak' ? '偶数/触发轮' : String(val));
            } else if (!matchedText && k === 'hitState') {
              matchedText = val === 'hit' ? '已受撞击+0%' : '未受撞击+45%';
            } else if (!matchedText && k === 'clicks') {
              var nClk = parseInt(val, 10);
              matchedText = (nClk >= 1 && nClk <= 3) ? (nClk + '次+' + (nClk * 10) + '%') : String(val);
            }
            optLabels.push(matchedText || (k + '=' + val));
          });
        }
        out.push(cname + (optLabels.length ? ' (' + optLabels.join(', ') + ')' : ''));
      });
    } else if (Array.isArray(p.chips) && p.chips.length > 0) {
      p.chips.forEach(function (c) {
        if (!c) return;
        var cname = c.name || CHIP_NAME_MAP[c.id] || c.id || c.type || '';
        if (cname) out.push(String(cname));
      });
    }
    return out;
  }

  function formatEmpsDetailed(p) {
    var empArr = Array.isArray(p.emps) ? p.emps : (Array.isArray(p.empowers) ? p.empowers : []);
    if (!empArr.length) return '';
    return empArr.map(function (empKey) {
      var k = String(empKey || '').trim();
      var base = resolveEmpowerLabel(k);
      if (!base) return '';
      if (k === 'jiezou') {
        var jf = Number(p.jiezou_first) || 0;
        var jl = Number(p.jiezou_loop) || 0;
        if (jf > 0 || jl > 0) return base + '(首' + fmtPlanNum(jf) + '/循' + fmtPlanNum(jl) + ')';
      } else if (k === 'queyi') {
        var qParts = [];
        if (p.queyi_self) qParts.push('己方');
        if (p.queyi_enemy) qParts.push('敌方');
        if (qParts.length) return base + '(' + qParts.join('+') + ')';
      } else if (k === 'huaxin') {
        var hf = Number(p.huaxin_first) || 0;
        var hl = Number(p.huaxin_loop) || 0;
        if (hf > 0 || hl > 0) return base + '(首' + fmtPlanNum(hf) + '/循' + fmtPlanNum(hl) + ')';
      }
      return base;
    }).filter(Boolean).join(' · ');
  }

  function resolveCarBaseline(car) {
    if (!car || typeof car !== 'object') return null;
    var ace = Number(car.ace_charge) || 0;
    var baseNitro = ace ? Math.round(ace / 100 * 10) / 10 : null;
    var initBonus = Number(car.init_ratio) || 0;
    var startCharge = ace ? Math.min(100, Math.round((ace + initBonus) / 100 * 10) / 10) : null;
    var ultThreshold = car.ult_threshold ? Number(car.ult_threshold) : 100;
    var baseUltDur = car.ult_duration !== undefined ? Number(car.ult_duration) || 0 : null;
    return {
      baseNitro: baseNitro,
      startCharge: startCharge,
      ultThreshold: ultThreshold,
      baseUltDur: baseUltDur
    };
  }

  function isTeamOnlyPlan(p) {
    var param = p || {};
    if (param.calc_mode === 'team') return true;
    if (param.calc_mode === 'solo') return false;
    var devKey = (param.device && DEVICE_LABEL_MAP[param.device] && param.device !== '0') ? param.device : '';
    if (devKey) return true;
    var th = Number(param.tuanhun !== undefined ? param.tuanhun : param.team_spirit) || 0;
    if (th > 0) return true;
    if ((devKey === 'chg' || devKey === 'schg') && ((Number(param.dev_sub_first) || 0) > 0 || (Number(param.dev_sub_loop) || 0) > 0)) return true;
    return false;
  }

  function resolvePlanMode(p) {
    return isTeamOnlyPlan(p) ? 'team' : 'solo';
  }

  function isPlanCompatibleWithMode(p, calcMode) {
    if (calcMode === 'solo') {
      return !isTeamOnlyPlan(p);
    }
    return true;
  }

  function extractAllPlanDetails(p, car) {
    var param = p || {};
    var xianji = param.xianji !== undefined ? (Number(param.xianji) || 0) : 0;
    var huineng = param.huineng !== undefined ? (Number(param.huineng) || 0) : 0;
    var rawTuanhun = param.tuanhun !== undefined ? param.tuanhun : param.team_spirit;
    var tuanhun = rawTuanhun !== undefined ? (Number(rawTuanhun) || 0) : 0;
    var devKey = DEVICE_LABEL_MAP[param.device] ? param.device : '';
    var counterRange = devKey ? 0 : (Number(param.counter_range) || 0);
    var debuffRange = devKey ? 0 : (Number(param.debuff_range) || 0);
    var isTeamPlan = isTeamOnlyPlan(param);

    var nitroRule = param.nitro_rule ? String(param.nitro_rule) : '';
    var nitroDur = param.nitro_dur !== undefined ? (Number(param.nitro_dur) || 0) : 0;
    var fnRaw = param.first_nitro_count !== undefined ? param.first_nitro_count : param.start_nitro_count;
    var firstNitroCount = fnRaw !== undefined ? Number(fnRaw) : 1;
    var lnRaw = param.loop_nitro_count !== undefined ? param.loop_nitro_count : param.cycle_nitro_count;
    var loopNitroCount = lnRaw !== undefined ? Number(lnRaw) : 0;
    var isManualNitro = Number(param.is_manual_nitro) === 1;

    var nitroInfo = nitroRule ? (nitroRule + (nitroDur ? ' · ' + fmtPlanNum(nitroDur) + 's' : '')) : '';
    if (nitroInfo && (isManualNitro || (Number.isFinite(firstNitroCount) && firstNitroCount !== 1))) {
      nitroInfo += ' (首' + (Number.isFinite(firstNitroCount) ? firstNitroCount : 1) +
        (isManualNitro ? '/循' + (Number.isFinite(loopNitroCount) ? loopNitroCount : 0) : '') + ')';
    }

    // 黄色高亮顶行（先机、汇能、第二模式下的团魂、反制：手机端强制同一行展示）
    var hlCells = [
      { lbl: '先机', val: fmtPlanNum(xianji) + '%', cls: 'is-acc' },
      { lbl: '汇能', val: fmtPlanNum(huineng) + '%', cls: 'is-acc' }
    ];
    if (tuanhun > 0 || param.calc_mode === 'team') {
      hlCells.push({ lbl: '团魂', val: fmtPlanNum(tuanhun) + '%', cls: 'is-acc' });
    }
    if (!devKey && counterRange > 0) {
      hlCells.push({ lbl: '反制', val: fmtPlanNum(counterRange) + '%', cls: 'is-acc' });
    }

    var specCells = [];
    if (nitroInfo) {
      specCells.push({ lbl: '氮气', val: nitroInfo, cls: '' });
    }
    if (devKey) {
      var devText = DEVICE_LABEL_MAP[devKey];
      var dsf = Number(param.dev_sub_first) || 0;
      var dsl = Number(param.dev_sub_loop) || 0;
      if ((devKey === 'chg' || devKey === 'schg') && (dsf > 0 || dsl > 0)) {
        devText += ' (首+' + fmtPlanNum(dsf) + '%/循+' + fmtPlanNum(dsl) + '%)';
      }
      specCells.push({ lbl: '装置', val: devText, cls: 'is-acc' });
    } else if (debuffRange > 0) {
      specCells.push({ lbl: '干扰', val: fmtPlanNum(debuffRange) + '%', cls: '' });
    }

    var extraRows = [];
    var chipsList = formatChipsList(param);
    if (chipsList.length > 0) {
      extraRows.push({ k: '芯片', v: chipsList.join(' + '), acc: true });
    }

    if (!devKey) {
      var empsDetailed = formatEmpsDetailed(param);
      if (empsDetailed) {
        extraRows.push({ k: '赋能', v: empsDetailed, acc: false });
      }
    }

    var traitParts = [];
    if (param.is_spec !== undefined && Number(param.is_spec) === 0) {
      traitParts.push('专精: 已关闭');
    }
    var extraEff = Number(param.extra_eff) || 0;
    if (extraEff !== 0) {
      traitParts.push('额外充能效率 ' + (extraEff > 0 ? '+' : '') + fmtPlanNum(extraEff) + '%');
    }
    if (traitParts.length > 0) {
      extraRows.push({ k: '特性', v: traitParts.join(' · '), acc: false });
    }

    var extParts = [];
    if (param.has_extra_nitro && Number(param.val_extra_nitro) > 0) {
      var enScope = [];
      if (param.chk_extra_nitro_first === undefined || param.chk_extra_nitro_first) enScope.push('首');
      if (param.chk_extra_nitro_loop === undefined || param.chk_extra_nitro_loop) enScope.push('循');
      extParts.push('氮气自充 +' + fmtPlanNum(param.val_extra_nitro) + '%' + (enScope.length === 1 ? '(' + enScope[0] + ')' : ''));
    }
    if (param.has_extra_ult && ((Number(param.val_extra_ult_first) || 0) > 0 || (Number(param.val_extra_ult_loop) || 0) > 0)) {
      extParts.push('大招自充 首+' + fmtPlanNum(param.val_extra_ult_first || 0) + '%/循+' + fmtPlanNum(param.val_extra_ult_loop || 0) + '%');
    }
    if (param.has_extra_per_sec && Number(param.val_extra_per_sec) > 0) {
      var epScope = [];
      if (param.chk_extra_per_sec_first === undefined || param.chk_extra_per_sec_first) epScope.push('首');
      if (param.chk_extra_per_sec_loop === undefined || param.chk_extra_per_sec_loop) epScope.push('循');
      extParts.push('每秒自充 +' + fmtPlanNum(param.val_extra_per_sec) + '%' + (epScope.length === 1 ? '(' + epScope[0] + ')' : ''));
    }
    var valCustomTrig = Number(param.val_custom_trig) || 0;
    if (valCustomTrig > 0) {
      extParts.push('自定义触发 +' + fmtPlanNum(valCustomTrig) + '%(首' + (Number(param.custom_trig_first) || 0) + '/循' + (Number(param.custom_trig_loop) || 0) + '次)');
    }
    if (extParts.length > 0) {
      extraRows.push({ k: '扩展', v: extParts.join(' · '), acc: false });
    }

    var tweakParts = [];
    var baseline = resolveCarBaseline(car);
    if (baseline) {
      if (baseline.ultThreshold !== null && param.ult_threshold !== undefined && Math.abs(Number(param.ult_threshold) - baseline.ultThreshold) > 0.05) {
        tweakParts.push('阈值 ' + fmtPlanNum(param.ult_threshold) + '%');
      }
      if (baseline.startCharge !== null && param.start_charge !== undefined && Math.abs(Number(param.start_charge) - baseline.startCharge) > 0.05) {
        tweakParts.push('起步 ' + fmtPlanNum(param.start_charge) + '%');
      }
      if (baseline.baseNitro !== null && param.base_nitro !== undefined && Math.abs(Number(param.base_nitro) - baseline.baseNitro) > 0.05) {
        tweakParts.push('单氮气 ' + fmtPlanNum(param.base_nitro) + '%');
      }
      if (baseline.baseUltDur !== null && param.base_ult_dur !== undefined && Math.abs(Number(param.base_ult_dur) - baseline.baseUltDur) > 0.05) {
        tweakParts.push('大招时长 ' + fmtPlanNum(param.base_ult_dur) + 's');
      }
    }
    if (tweakParts.length > 0) {
      extraRows.push({ k: '微调', v: tweakParts.join(' · '), acc: false });
    }

    var summaryParts = [
      '先机 ' + fmtPlanNum(xianji) + '%',
      '汇能 ' + fmtPlanNum(huineng) + '%'
    ];
    if (tuanhun > 0) summaryParts.push('团魂 ' + fmtPlanNum(tuanhun) + '%');
    if (nitroInfo) summaryParts.push('氮气 ' + nitroInfo);
    if (devKey) {
      var devSummary = DEVICE_LABEL_MAP[devKey];
      var sDsf = Number(param.dev_sub_first) || 0;
      var sDsl = Number(param.dev_sub_loop) || 0;
      if ((devKey === 'chg' || devKey === 'schg') && (sDsf > 0 || sDsl > 0)) {
        devSummary += '(+' + fmtPlanNum(sDsf) + '%/+' + fmtPlanNum(sDsl) + '%)';
      }
      summaryParts.push(devSummary);
    } else {
      if (counterRange > 0) summaryParts.push('反制 ' + fmtPlanNum(counterRange) + '%');
      if (debuffRange > 0) summaryParts.push('干扰 ' + fmtPlanNum(debuffRange) + '%');
    }
    if (chipsList.length > 0) summaryParts.push('芯片: ' + chipsList.join('+'));
    if (!devKey && extraRows.some(function (r) { return r.k === '赋能'; })) {
      summaryParts.push(extraRows.find(function (r) { return r.k === '赋能'; }).v);
    }
    if (traitParts.length > 0) summaryParts.push(traitParts.join(' · '));
    if (extParts.length > 0) summaryParts.push(extParts.join(' · '));
    if (tweakParts.length > 0) summaryParts.push('微调: ' + tweakParts.join('/'));

    return {
      hlCells: hlCells,
      specCells: specCells,
      extraRows: extraRows,
      isTeamPlan: isTeamPlan,
      summaryText: summaryParts.join(' · ')
    };
  }

  // 统一规范 SVG 线性图标集 (与全站 stroke="currentColor" stroke-width="1.8" 100% 对齐)
  var Icons = {
    chip: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
    save: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    edit: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    bell: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    upload: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    undo: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    megaphone: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    hot: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    grid: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
    user: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    crown: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    thumb: function (isFilled) {
      return '<svg class="ico" viewBox="0 0 24 24" fill="' + (isFilled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
    },
    trash: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    apply: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    close: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    link: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    bili: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="m8 3 4 3 4-3"/></svg>',
    douyin: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/></svg>',
    kuaishou: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
    emptyBox: '<svg class="ico cp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    emptyCar: '<svg class="ico cp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.9 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    chevron: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    copy: '<svg class="ico cp-ico-def" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    checkCopy: '<svg class="ico cp-ico-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    spinner: '<svg class="ico cp-spin-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
    partner: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    aiSpark: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>'
  };

  function cpMotionOK() {
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return !rm && !document.body.classList.contains('performance-mode');
  }

  // 内存状态
  var state = {
    currentCarId: null,
    currentCar: null,
    activeTab: 'all',       // 'all' | 'mine' | 'pro'
    sortMode: 'hot',        // 'hot' | 'latest'
    filterMode: 'all',      // 'all' | 'solo' | 'team'
    fetchSeq: 0,            // 防止快速切车/切换排序时并发响应覆盖新列表
    officialFetchSeq: 0,    // 官方 AI 推荐独立请求序号
    officialTier: '16-99',  // 当前查看的官方 AI 段位: '16-99' | '10-15' | '1-9'
    officialChips: null,    // 当前车型的官方 AI 推荐数据
    officialChipsByCar: {}, // 按车型缓存已拉取的官方 AI 数据
    isFetchingOfficial: false,
    savedPlans: [],         // 本地存储的方案列表
    proPlans: [],           // 后端过审的国服顶尖方案列表
    remotePlans: [],        // 远程从私有后端 API 拉取的社区方案列表（按页懒加载累加）
    remotePage: 1,
    remotePageSize: 8,
    remoteTotal: 0,
    remoteCategoryTotals: { partner: 0, pro: 0, community: 0 },
    remoteCategoryTotalsMode: 'all',
    allCarTotal: 0,
    remoteTotalPages: 1,
    remoteHasMore: false,
    isLoadingMore: false,
    _lazyObserver: null,
    votedMap: {},           // 已点赞方案 ID 持久化映射
    siteMeta: {             // 从后端实时拉取的站点与安全开关元数据
      maintenance_mode: false,
      maintenance_message: '',
      allow_submissions: true,
      allow_pro_applications: true,
      allow_voting: true,
      turnstile_required: true,
      announcement: null,
      notifications: []
    },
    _annSessionCounted: false,
    _annCheckedVersion: null,
    deviceFp: '',           // 稳定硬件设备指纹（32~64 位小写 hex）
    lastSnapshot: null,     // 用于一键撤销还原的表单快照
    activeAppliedPlanId: null, // 当前已套用的方案 ID (用于高亮正在生效)
    appliedSource: null,    // 记录最近一次套用的方案元信息 { id, title, isOther, buildSig }
    hasUndoAvailable: false,
    userCollapsed: false,   // 仅在用户主动点击标题栏或折叠按钮时更新；默认始终保持展开
    draftTimer: null,
    isFetchingRemote: false
  };

  // 工具函数
  var Utils = {
    now: function () {
      return Date.now();
    },
    uuid: function () {
      return 'loc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    },
    getStorage: function (key, defVal) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defVal;
      } catch (e) {
        console.warn('[CommunityPlans] 读取 localStorage 失败:', e);
        return defVal;
      }
    },
    setStorage: function (key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
        return true;
      } catch (e) {
        console.error('[CommunityPlans] 写入 localStorage 失败:', e);
        return false;
      }
    },
    charCount: function (str) {
      if (!str) return 0;
      return Array.from(str).length;
    },
    truncateChars: function (str, maxLen) {
      if (!str) return '';
      var arr = Array.from(str);
      if (arr.length <= maxLen) return str;
      return arr.slice(0, maxLen).join('');
    },
    formatTime: function (ts) {
      if (!ts) return '刚刚';
      var diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
      if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
      return new Date(ts).toLocaleDateString();
    },
    escapeHtml: function (str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    extractProfileLink: function (rawInput) {
      var cleaned = String(rawInput || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
      if (!cleaned) return { ok: true, empty: true, url: '', platform: '', label: '', changed: false };
      var rawUrlRegex = /https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?/ig;
      var bareStartRegex = /^(?:(?:space|m|www)\.bilibili\.com\/|(?:b23\.tv|bili2233\.cn)\/|(?:v|www|m)\.douyin\.com\/|(?:www\.|m\.)?iesdouyin\.com\/|(?:v|www|live|m|c)\.kuaishou\.com\/)/i;
      var candidates = [];
      var matches = cleaned.match(rawUrlRegex);
      if (matches && matches.length > 0) {
        candidates = matches;
      } else if (bareStartRegex.test(cleaned)) {
        var bare = cleaned.split(/[\s\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF<>"'`\\]/)[0];
        if (bare) candidates.push('https://' + bare);
      }

      for (var i = 0; i < candidates.length; i++) {
        var rawCandidate = String(candidates[i]).replace(/[.,;!?)\]]+$/g, '');
        var u;
        try {
          u = new URL(rawCandidate);
        } catch (e) {
          continue;
        }
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password || u.port) {
          continue;
        }
        var host = u.hostname.toLowerCase();
        var path = u.pathname || '/';
        var m;

        // B站
        if (host === 'space.bilibili.com') {
          m = path.match(/^\/(\d{1,20})(?:\/.*)?$/);
          if (m) {
            var u1 = 'https://space.bilibili.com/' + m[1];
            return { ok: true, empty: false, platform: 'bili', label: 'B站主页', url: u1, changed: u1 !== cleaned };
          }
        }
        if (host === 'm.bilibili.com' || host === 'www.bilibili.com') {
          m = path.match(/^\/space\/(\d{1,20})(?:\/.*)?$/);
          if (m) {
            var u2 = 'https://space.bilibili.com/' + m[1];
            return { ok: true, empty: false, platform: 'bili', label: 'B站主页', url: u2, changed: u2 !== cleaned };
          }
        }
        if (host === 'b23.tv' || host === 'bili2233.cn') {
          m = path.match(/^\/([A-Za-z0-9_-]{4,24})\/?$/);
          if (m) {
            var u3 = 'https://' + host + '/' + m[1];
            return { ok: true, empty: false, platform: 'bili', label: 'B站主页', url: u3, changed: u3 !== cleaned };
          }
        }

        // 抖音
        if (host === 'v.douyin.com') {
          m = path.match(/^\/([A-Za-z0-9_-]{4,32})(?:\/.*)?$/);
          if (m) {
            var u4 = 'https://v.douyin.com/' + m[1] + '/';
            return { ok: true, empty: false, platform: 'douyin', label: '抖音主页', url: u4, changed: u4 !== cleaned };
          }
        }
        if (host === 'www.douyin.com' || host === 'm.douyin.com') {
          m = path.match(/^\/user\/([A-Za-z0-9_-]{4,128})(?:\/.*)?$/);
          if (m) {
            var u5 = 'https://www.douyin.com/user/' + m[1];
            return { ok: true, empty: false, platform: 'douyin', label: '抖音主页', url: u5, changed: u5 !== cleaned };
          }
        }
        if (host === 'iesdouyin.com' || host === 'www.iesdouyin.com' || host === 'm.iesdouyin.com') {
          m = path.match(/^\/share\/user\/([A-Za-z0-9_-]{4,128})(?:\/.*)?$/);
          if (m) {
            var secUid = u.searchParams.get('sec_uid') || '';
            var u6 = /^[A-Za-z0-9_-]{8,128}$/.test(secUid)
              ? 'https://www.douyin.com/user/' + secUid
              : 'https://www.iesdouyin.com/share/user/' + m[1];
            return { ok: true, empty: false, platform: 'douyin', label: '抖音主页', url: u6, changed: u6 !== cleaned };
          }
        }

        // 快手
        if (host === 'v.kuaishou.com') {
          m = path.match(/^\/((?:f\/)?[A-Za-z0-9_-]{4,32})(?:\/.*)?$/);
          if (m) {
            var u7 = 'https://v.kuaishou.com/' + m[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u7, changed: u7 !== cleaned };
          }
        }
        if (host === 'www.kuaishou.com' || host === 'live.kuaishou.com' || host === 'm.kuaishou.com') {
          var mp = path.match(/^\/profile\/([A-Za-z0-9_-]{4,64})(?:\/.*)?$/);
          if (mp) {
            var u8 = 'https://www.kuaishou.com/profile/' + mp[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u8, changed: u8 !== cleaned };
          }
          var mu = path.match(/^\/u\/([A-Za-z0-9_-]{4,64})(?:\/.*)?$/);
          if (mu) {
            var u9 = 'https://www.kuaishou.com/u/' + mu[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u9, changed: u9 !== cleaned };
          }
        }
        if (host === 'c.kuaishou.com') {
          var mf = path.match(/^\/fw\/user\/([A-Za-z0-9_-]{4,64})(?:\/.*)?$/);
          if (mf) {
            var u10 = 'https://c.kuaishou.com/fw/user/' + mf[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u10, changed: u10 !== cleaned };
          }
        }
      }

      return { ok: false, empty: false, url: '', platform: '', label: '', changed: false };
    },
    sanitizeUrl: function (url) {
      var res = Utils.extractProfileLink(url);
      if (res && res.ok && !res.empty && res.url && res.url.length <= 200) {
        return res.url;
      }
      return '';
    },
    safeId: function (id) {
      if (!id) return '';
      return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    },
    getClientId: function () {
      try {
        var cid = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
        if (cid && /^[a-zA-Z0-9_-]{8,64}$/.test(cid)) return cid;
        cid = 'cid_' + Math.random().toString(36).substr(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem(STORAGE_KEYS.CLIENT_ID, cid);
        return cid;
      } catch (e) {
        return 'cid_anon_fallback';
      }
    },
    _collectFpRaw: function () {
      var parts = [];
      try {
        parts.push(navigator.userAgent || '');
        parts.push(navigator.language || '');
        parts.push(Array.isArray(navigator.languages) ? navigator.languages.join(',') : '');
        parts.push(navigator.platform || '');
        parts.push(String(navigator.hardwareConcurrency || 0));
        parts.push(String(navigator.deviceMemory || 0));
        parts.push(String(navigator.maxTouchPoints || 0));
        if (window.screen) {
          parts.push([screen.width, screen.height, screen.colorDepth, screen.pixelDepth, window.devicePixelRatio || 1].join('x'));
        }
        try {
          parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
        } catch (_) {}
        try {
          var canvas = document.createElement('canvas');
          canvas.width = 220;
          canvas.height = 44;
          var ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#1e90e8';
            ctx.fillRect(6, 4, 80, 18);
            ctx.fillStyle = '#0f172a';
            ctx.fillText('ARC_FP_v1_' + (navigator.platform || ''), 8, 8);
            parts.push(canvas.toDataURL().slice(-120));
          }
        } catch (_) {}
        try {
          var glCanvas = document.createElement('canvas');
          var gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
          if (gl) {
            var dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
              parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || ''));
              parts.push(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''));
            }
          }
        } catch (_) {}
      } catch (_) {}
      return parts.join('|');
    },
    _fnvHex32: function (str) {
      var seeds = [0x811c9dc5, 0x9e3779b9, 0x243f6a88, 0xb7e15162];
      var out = '';
      for (var s = 0; s < seeds.length; s++) {
        var h = seeds[s] >>> 0;
        for (var i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        out += ('00000000' + h.toString(16)).slice(-8);
      }
      return out.toLowerCase();
    },
    getDeviceFingerprint: function () {
      if (state.deviceFp && /^[a-f0-9]{16,64}$/i.test(state.deviceFp)) {
        return state.deviceFp;
      }
      try {
        var cached = localStorage.getItem(STORAGE_KEYS.DEVICE_FP);
        if (cached && /^[a-f0-9]{16,64}$/i.test(cached)) {
          state.deviceFp = cached.toLowerCase();
          return state.deviceFp;
        }
      } catch (_) {}
      var raw = Utils._collectFpRaw();
      var fp = Utils._fnvHex32(raw);
      state.deviceFp = fp;
      try { localStorage.setItem(STORAGE_KEYS.DEVICE_FP, fp); } catch (_) {}
      return fp;
    },
    initFingerprintAsync: function () {
      var raw = Utils._collectFpRaw();
      if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
        try {
          var buf = new TextEncoder().encode(raw);
          window.crypto.subtle.digest('SHA-256', buf).then(function (hashBuf) {
            var arr = Array.from(new Uint8Array(hashBuf));
            var hex = arr.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
            if (/^[a-f0-9]{64}$/.test(hex)) {
              state.deviceFp = hex;
              try { localStorage.setItem(STORAGE_KEYS.DEVICE_FP, hex); } catch (_) {}
            }
          }).catch(function () {});
        } catch (_) {}
      }
      return Utils.getDeviceFingerprint();
    },
    getApiHeaders: function (includeJson) {
      var h = {
        'X-Client-ID': Utils.getClientId(),
        'X-Device-FP': Utils.getDeviceFingerprint()
      };
      try {
        var token = localStorage.getItem('arc_user_identity_v1');
        if (!/^[a-f0-9]{64}$/.test(token || '') && window.crypto && window.crypto.getRandomValues) {
          var bytes = new Uint8Array(32);
          window.crypto.getRandomValues(bytes);
          token = Array.from(bytes, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
          localStorage.setItem('arc_user_identity_v1', token);
        }
        if (/^[a-f0-9]{64}$/.test(token || '')) h['X-User-Identity'] = token;
      } catch (_) {}
      if (includeJson) h['Content-Type'] = 'application/json';
      return h;
    },
    identityMatches: function (token) {
      if (!/^[a-f0-9]{64}$/.test(token || '')) return false;
      try { return localStorage.getItem('arc_user_identity_v1') === token; } catch (_) { return false; }
    },
    detectPlatform: function (url) {
      var res = Utils.extractProfileLink(url);
      if (res && res.ok && !res.empty) {
        if (res.platform === 'bili') return { label: 'B站主页', cls: 'is-bili', icon: Icons.bili };
        if (res.platform === 'douyin') return { label: '抖音主页', cls: 'is-douyin', icon: Icons.douyin };
        if (res.platform === 'kuaishou') return { label: '快手主页', cls: 'is-ks', icon: Icons.kuaishou };
      }
      return { label: '作者主页', cls: '', icon: Icons.link };
    },
    parseJsonSafe: function (res) {
      return res.text().then(function (txt) {
        var parsed = null;
        if (txt) {
          try { parsed = JSON.parse(txt); } catch (_) { parsed = null; }
        }
        return { ok: res.ok, status: res.status, data: parsed, rawText: txt || '' };
      });
    },
    getDataUrlDecodedBytes: function (dUrl) {
      if (!dUrl || typeof dUrl !== 'string') return 0;
      var idx = dUrl.indexOf(',');
      var b64 = idx >= 0 ? dUrl.slice(idx + 1) : dUrl;
      return Math.floor(b64.length * 0.75);
    },
    computeLocalBuildSig: function (carId, p) {
      var paramObj = p || {};
      var num = function (v, d) {
        var n = Number(v);
        return Number.isFinite(n) ? Number(n.toFixed(4)) : d;
      };
      var emps = Array.isArray(paramObj.emps)
        ? paramObj.emps.slice()
        : (Array.isArray(paramObj.empowers) ? paramObj.empowers.slice() : []);
      emps = emps.map(function (x) { return String(x || '').trim(); }).filter(Boolean).sort();
      var chipsRaw = Array.isArray(paramObj.chips_on)
        ? paramObj.chips_on
        : (Array.isArray(paramObj.chips) ? paramObj.chips : []);
      var chips = chipsRaw.map(function (c) {
        if (!c || typeof c !== 'object') return String(c || '').trim();
        var o = c.opts && typeof c.opts === 'object' ? c.opts : {};
        var optStr = Object.keys(o).sort().map(function (k) { return k + '=' + String(o[k]); }).join(',');
        return String(c.id || c.name || c.type || '') + (optStr ? ':' + optStr : '');
      }).filter(Boolean).sort();
      var calcModeNorm = paramObj.calc_mode === 'team' ? 'team' : 'solo';
      var normDevice = calcModeNorm === 'solo' ? '' : String(paramObj.device || '').trim().toLowerCase();
      var hasChargeDev = normDevice === 'chg' || normDevice === 'schg';
      var canonical = [
        'car=' + String(carId || ''),
        'cm=' + calcModeNorm,
        'ut=' + num(paramObj.ult_threshold, 100),
        'sc=' + num(paramObj.start_charge, 0),
        'bn=' + num(paramObj.base_nitro, 0),
        'nr=' + String(paramObj.nitro_rule || '1x5'),
        'nd=' + num(paramObj.nitro_dur, 0),
        'bud=' + num(paramObj.base_ult_dur, 0),
        'spec=' + (paramObj.is_spec === 0 ? 0 : 1),
        'cr=' + num(paramObj.counter_range, 0),
        'dr=' + num(paramObj.debuff_range, 0),
        'xj=' + num(paramObj.xianji, 0),
        'hn=' + num(paramObj.huineng, 0),
        'mn=' + (paramObj.is_manual_nitro ? 1 : 0),
        'fn=' + num(paramObj.first_nitro_count !== undefined ? paramObj.first_nitro_count : paramObj.start_nitro_count, 1),
        'ln=' + num(paramObj.loop_nitro_count !== undefined ? paramObj.loop_nitro_count : paramObj.cycle_nitro_count, 0),
        'th=' + (calcModeNorm === 'solo' ? 0 : num(paramObj.tuanhun !== undefined ? paramObj.tuanhun : paramObj.team_spirit, 0)),
        'dev=' + normDevice,
        'dsf=' + (calcModeNorm === 'solo' || !hasChargeDev ? 0 : num(paramObj.dev_sub_first, 0)),
        'dsl=' + (calcModeNorm === 'solo' || !hasChargeDev ? 0 : num(paramObj.dev_sub_loop, 0)),
        'jf=' + num(paramObj.jiezou_first, 0),
        'jl=' + num(paramObj.jiezou_loop, 0),
        'qs=' + (paramObj.queyi_self ? 1 : 0),
        'qe=' + (paramObj.queyi_enemy ? 1 : 0),
        'hf=' + num(paramObj.huaxin_first, 0),
        'hl=' + num(paramObj.huaxin_loop, 0),
        'ef=' + num(paramObj.extra_eff, 0),
        'en=' + (paramObj.has_extra_nitro ? num(paramObj.val_extra_nitro, 0) : 0) + ':' + (paramObj.chk_extra_nitro_first ? 1 : 0) + ':' + (paramObj.chk_extra_nitro_loop ? 1 : 0),
        'eu=' + (paramObj.has_extra_ult ? 1 : 0) + ':' + num(paramObj.val_extra_ult_first, 0) + ':' + num(paramObj.val_extra_ult_loop, 0),
        'ep=' + (paramObj.has_extra_per_sec ? num(paramObj.val_extra_per_sec, 0) : 0) + ':' + (paramObj.chk_extra_per_sec_first ? 1 : 0) + ':' + (paramObj.chk_extra_per_sec_loop ? 1 : 0),
        'ct=' + num(paramObj.val_custom_trig, 0) + ':' + num(paramObj.custom_trig_first, 0) + ':' + num(paramObj.custom_trig_loop, 0),
        'emps=' + emps.join(','),
        'chips=' + chips.join(',')
      ].join('|');
      return Utils._fnvHex32(canonical);
    }
  };

  // 参数读写与镜像引擎 (ParamsIO - 带 DOM 空指针防御与前后端双套字段兼容)
  var ParamsIO = {
    getVal: function (id, defVal) {
      var el = document.getElementById(id);
      if (!el) return defVal;
      var num = parseFloat(el.value);
      return Number.isFinite(num) ? num : defVal;
    },
    getInt: function (id, defVal) {
      var el = document.getElementById(id);
      if (!el) return defVal;
      var num = parseInt(el.value, 10);
      return Number.isFinite(num) ? num : defVal;
    },
    getChk: function (id) {
      var el = document.getElementById(id);
      return (el && el.checked) ? 1 : 0;
    },
    setVal: function (id, val) {
      if (val === undefined || val === null) return;
      var el = document.getElementById(id);
      if (el) el.value = val;
    },
    setChk: function (id, val) {
      if (val === undefined || val === null) return;
      var el = document.getElementById(id);
      if (el) el.checked = !!val;
    },
    capture: function () {
      var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked') || document.querySelector('input[name="nitro_radio"]:checked');
      var nr = checkedRadio ? checkedRadio.value : '1x5';
      var nd = ParamsIO.getVal('time_' + nr, 0);

      var emps = Array.from(document.querySelectorAll('.empower-checkbox:checked')).map(function (cb) {
        return cb.value;
      });

      var chipsOn = [];
      if (window._chipsOn && Array.isArray(window._chipsOn)) {
        chipsOn = window._chipsOn.map(function (c) {
          if (!c || typeof c !== 'object') return c;
          return {
            id: c.id,
            opts: c.opts ? Object.assign({}, c.opts) : {}
          };
        });
      }

      var curMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      var isTeamMode = (curMode === 'team');
      var capturedDev = (isTeamMode && typeof window.getDevice === 'function') ? String(window.getDevice() || '') : '';
      var hasChargeDevice = isTeamMode && (capturedDev === 'chg' || capturedDev === 'schg');

      return {
        schema_version: 2,
        calc_mode: isTeamMode ? 'team' : 'solo',
        ult_threshold: ParamsIO.getVal('ultThreshold', 100),
        start_charge: ParamsIO.getVal('startCharge', 0),
        base_nitro: ParamsIO.getVal('baseNitro', 0),
        nitro_rule: nr,
        nitro_dur: nd,
        base_ult_dur: ParamsIO.getVal('baseUltDuration', 0),
        is_spec: ParamsIO.getChk('isSpec'),
        counter_range: ParamsIO.getVal('counterRange', 0),
        debuff_range: ParamsIO.getVal('debuffRange', 0),
        emps: emps,
        jiezou_first: ParamsIO.getVal('jiezou_sub_first', 0),
        jiezou_loop: ParamsIO.getVal('jiezou_sub_loop', 0),
        queyi_self: ParamsIO.getChk('queyi_sub_self'),
        queyi_enemy: ParamsIO.getChk('queyi_sub_enemy'),
        huaxin_first: ParamsIO.getVal('huaxin_sub_first', 0),
        huaxin_loop: ParamsIO.getVal('huaxin_sub_loop', 0),
        has_extra_nitro: ParamsIO.getChk('hasExtraNitro'),
        val_extra_nitro: ParamsIO.getVal('valExtraNitro', 0),
        chk_extra_nitro_first: ParamsIO.getChk('chkExtraNitroFirst'),
        chk_extra_nitro_loop: ParamsIO.getChk('chkExtraNitroLoop'),
        has_extra_ult: ParamsIO.getChk('hasExtraUlt'),
        val_extra_ult_first: ParamsIO.getVal('valExtraUltFirst', 0),
        val_extra_ult_loop: ParamsIO.getVal('valExtraUltLoop', 0),
        has_extra_per_sec: ParamsIO.getChk('hasExtraPerSec'),
        val_extra_per_sec: ParamsIO.getVal('valExtraPerSec', 0),
        chk_extra_per_sec_first: ParamsIO.getChk('chkExtraPerSecFirst'),
        chk_extra_per_sec_loop: ParamsIO.getChk('chkExtraPerSecLoop'),
        val_custom_trig: ParamsIO.getVal('valCustomTrig', 0),
        custom_trig_first: ParamsIO.getInt('customTrigFirstCount', 0),
        custom_trig_loop: ParamsIO.getInt('customTrigLoopCount', 0),
        extra_eff: ParamsIO.getVal('extraEfficiency', 0),
        first_nitro_count: ParamsIO.getInt('inputFirstNitroCount', 1),
        xianji: ParamsIO.getVal('inputXianji', 0),
        huineng: ParamsIO.getVal('inputHuineng', 0),
        is_manual_nitro: window.isManualNitroCount ? 1 : 0,
        loop_nitro_count: ParamsIO.getInt('inputNitroCount', 0),
        device: capturedDev,
        dev_sub_first: hasChargeDevice ? ParamsIO.getVal('dev_sub_first', 0) : 0,
        dev_sub_loop: hasChargeDevice ? ParamsIO.getVal('dev_sub_loop', 0) : 0,
        tuanhun: isTeamMode ? ParamsIO.getVal('inputTuanhun', 0) : 0,
        chips_on: chipsOn
      };
    },

    apply: function (p) {
      if (!p) return;

      var prevRestoring = window.isRestoringConfig;
      window.isRestoringConfig = true;
      try {
        var curCalcMode = (typeof window.getCalcMode === 'function')
          ? window.getCalcMode()
          : (document.body.getAttribute('data-calc-mode') || 'solo');
        var targetDevice = (curCalcMode === 'team' && p.device && p.device !== '0') ? String(p.device) : '';
        // 必须先还原增益装置状态以解除旧装置的禁用锁与历史快照，避免覆盖新方案的反制与赋能参数
        if (typeof window.setDevice === 'function') {
          window.setDevice(targetDevice, true);
        }
        ParamsIO.setVal('dev_sub_first', (targetDevice === 'chg' || targetDevice === 'schg') && p.dev_sub_first !== undefined ? p.dev_sub_first : 0);
        ParamsIO.setVal('dev_sub_loop', (targetDevice === 'chg' || targetDevice === 'schg') && p.dev_sub_loop !== undefined ? p.dev_sub_loop : 0);

        ParamsIO.setVal('ultThreshold', p.ult_threshold);
        ParamsIO.setVal('startCharge', p.start_charge);
        ParamsIO.setVal('baseNitro', p.base_nitro);
        ParamsIO.setVal('baseUltDuration', p.base_ult_dur);
        ParamsIO.setChk('isSpec', p.is_spec !== undefined ? p.is_spec : 1);
        var targetCounter = p.counter_range !== undefined ? p.counter_range : 0;
        var targetDebuff = p.debuff_range !== undefined ? p.debuff_range : 0;
        if (typeof window.setEnvSliders === 'function') {
          window.setEnvSliders(targetCounter, targetDebuff);
        } else {
          ParamsIO.setVal('counterRange', targetCounter);
          var cv = document.getElementById('counterValue');
          if (cv) cv.innerText = targetCounter + '%';
          ParamsIO.setVal('debuffRange', targetDebuff);
          var dv = document.getElementById('debuffValue');
          if (dv) dv.innerText = targetDebuff + '%';
        }

        if (p.nitro_rule) {
          var r = document.getElementById('r_' + p.nitro_rule);
          if (r) {
            r.checked = true;
            if (typeof window.handleNitroRadioChange === 'function') window.handleNitroRadioChange(true);
          }
          var tInput = document.getElementById('time_' + p.nitro_rule);
          if (tInput && p.nitro_dur !== undefined) {
            tInput.value = p.nitro_dur;
            if (typeof window.syncNitroTimes === 'function') window.syncNitroTimes(p.nitro_rule);
          }
        }

        var cbs = document.querySelectorAll('.empower-checkbox');
        cbs.forEach(function (cb) { cb.checked = false; });
        var empList = Array.isArray(p.emps) ? p.emps : (Array.isArray(p.empowers) ? p.empowers : null);
        if (empList) {
          empList.forEach(function (eid) {
            var cb = document.getElementById('chk_' + eid);
            if (cb) {
              cb.checked = true;
              if (typeof window.handleEmpowerChange === 'function') window.handleEmpowerChange(cb);
            }
          });
        }

        ParamsIO.setVal('jiezou_sub_first', p.jiezou_first !== undefined ? p.jiezou_first : 0);
        ParamsIO.setVal('jiezou_sub_loop', p.jiezou_loop !== undefined ? p.jiezou_loop : 0);
        ParamsIO.setChk('queyi_sub_self', p.queyi_self !== undefined ? p.queyi_self : 0);
        ParamsIO.setChk('queyi_sub_enemy', p.queyi_enemy !== undefined ? p.queyi_enemy : 0);
        ParamsIO.setVal('huaxin_sub_first', p.huaxin_first !== undefined ? p.huaxin_first : 0);
        ParamsIO.setVal('huaxin_sub_loop', p.huaxin_loop !== undefined ? p.huaxin_loop : 0);

        ParamsIO.setChk('hasExtraNitro', p.has_extra_nitro !== undefined ? p.has_extra_nitro : 0);
        ParamsIO.setVal('valExtraNitro', p.val_extra_nitro !== undefined ? p.val_extra_nitro : 0);
        ParamsIO.setChk('chkExtraNitroFirst', p.chk_extra_nitro_first !== undefined ? p.chk_extra_nitro_first : 1);
        ParamsIO.setChk('chkExtraNitroLoop', p.chk_extra_nitro_loop !== undefined ? p.chk_extra_nitro_loop : 1);

        ParamsIO.setChk('hasExtraUlt', p.has_extra_ult !== undefined ? p.has_extra_ult : 0);
        ParamsIO.setVal('valExtraUltFirst', p.val_extra_ult_first !== undefined ? p.val_extra_ult_first : 0);
        ParamsIO.setVal('valExtraUltLoop', p.val_extra_ult_loop !== undefined ? p.val_extra_ult_loop : 0);

        ParamsIO.setChk('hasExtraPerSec', p.has_extra_per_sec !== undefined ? p.has_extra_per_sec : 0);
        ParamsIO.setVal('valExtraPerSec', p.val_extra_per_sec !== undefined ? p.val_extra_per_sec : 0);
        ParamsIO.setChk('chkExtraPerSecFirst', p.chk_extra_per_sec_first !== undefined ? p.chk_extra_per_sec_first : 1);
        ParamsIO.setChk('chkExtraPerSecLoop', p.chk_extra_per_sec_loop !== undefined ? p.chk_extra_per_sec_loop : 1);

        ParamsIO.setVal('valCustomTrig', p.val_custom_trig !== undefined ? p.val_custom_trig : 0);
        ParamsIO.setVal('customTrigFirstCount', p.custom_trig_first !== undefined ? p.custom_trig_first : 0);
        ParamsIO.setVal('customTrigLoopCount', p.custom_trig_loop !== undefined ? p.custom_trig_loop : 0);

        if (typeof window.toggleExtraUI === 'function') window.toggleExtraUI();

        ParamsIO.setVal('extraEfficiency', p.extra_eff !== undefined ? p.extra_eff : 0);
        var firstNitro = p.first_nitro_count !== undefined ? p.first_nitro_count : p.start_nitro_count;
        ParamsIO.setVal('inputFirstNitroCount', firstNitro !== undefined ? firstNitro : 1);
        ParamsIO.setVal('inputXianji', p.xianji !== undefined ? p.xianji : 0);
        ParamsIO.setVal('inputHuineng', p.huineng !== undefined ? p.huineng : 0);
        var tuanhunVal = p.tuanhun !== undefined ? p.tuanhun : p.team_spirit;
        ParamsIO.setVal('inputTuanhun', tuanhunVal !== undefined ? tuanhunVal : 0);

        // 团魂获能模式下套用方案时锁住三项输入值，防止紧接着 calculate() 自动反算覆盖方案原数值
        if (curCalcMode === 'team' && window._tm && window._tm.lock) {
          window._tm.lock = { soul: true, xianji: true, huineng: true };
          window._tm.res = null;
          if (typeof window._tmRender === 'function') window._tmRender();
        }

        var loopNitro = p.loop_nitro_count !== undefined ? p.loop_nitro_count : p.cycle_nitro_count;
        if (p.is_manual_nitro !== undefined || loopNitro !== undefined) {
          window.isManualNitroCount = p.is_manual_nitro !== undefined ? !!p.is_manual_nitro : true;
          ParamsIO.setVal('inputNitroCount', loopNitro !== undefined ? loopNitro : 0);
        } else {
          window.isManualNitroCount = false;
        }
        if (typeof window.updateNitroCountUI === 'function') window.updateNitroCountUI();

        var chipsList = Array.isArray(p.chips_on) ? p.chips_on : (Array.isArray(p.chips) ? p.chips : []);
        var normChips = chipsList.map(function (c) {
          if (typeof c === 'string') return { id: c, opts: { loopMode: 'peak' } };
          if (c && typeof c === 'object') {
            return {
              id: c.id || c.type || c.name || '',
              opts: c.opts && typeof c.opts === 'object' ? Object.assign({}, c.opts) : {}
            };
          }
          return null;
        }).filter(function (c) { return c && c.id; });
        if (typeof window.chipRestore === 'function') {
          var serialized = normChips.length ? normChips.map(function (inst) {
            var o = Object.keys(inst.opts || {}).map(function (k) { return k + '=' + inst.opts[k]; }).join(',');
            return inst.id + (o ? '.' + o : '');
          }).join('-') : '0';
          window.chipRestore(serialized);
        } else if (typeof window.renderChips === 'function') {
          window._chipsOn = normChips;
          window.renderChips(true);
        }
      } finally {
        window.isRestoringConfig = prevRestoring;
      }

      if (typeof window.calculate === 'function') {
        window.calculate();
      }
    }
  };

  // 自动草稿模块 (Auto Draft)
  var Draft = {
    isEnabled: function () {
      try {
        return localStorage.getItem(STORAGE_KEYS.AUTO_DRAFT) !== 'off';
      } catch (e) {
        return true;
      }
    },
    paintSwitch: function () {
      var opt = document.getElementById('autoDraftOption');
      var sw = document.getElementById('autoDraftState');
      var on = Draft.isEnabled();
      if (opt) opt.setAttribute('aria-checked', on ? 'true' : 'false');
      if (sw) sw.classList.toggle('on', on);
    },
    toggle: function () {
      var cur = Draft.isEnabled();
      var next = !cur;
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_DRAFT, next ? 'on' : 'off');
        if (!next) {
          localStorage.removeItem(STORAGE_KEYS.DRAFT);
        } else {
          // 重新开启时：若当前已选赛车，立即自动将当前页面状态保存为最新草稿！
          Draft.save();
        }
      } catch (e) {}
      Draft.paintSwitch();
      var m = document.getElementById('authorMenu');
      if (m) setTimeout(function () { m.classList.remove('show'); }, 260);
      var tip = next ? '已开启：刷新后自动恢复草稿' : '已关闭：刷新后不恢复草稿';
      if (typeof window.showToast === 'function') {
        window.showToast(tip);
      } else if (typeof CommunityPlans.toast === 'function') {
        CommunityPlans.toast(tip);
      }
    },
    init: function () {
      Draft.paintSwitch();
      // 关键修复：无条件全局绑定 input 和 change 监听器！
      // 这样即使用户在关闭状态下刷新，后续再在菜单中开启时，监听器依然时刻就绪
      document.addEventListener('input', Draft.scheduleSave, { passive: true });
      document.addEventListener('change', Draft.scheduleSave, { passive: true });

      var params = new URLSearchParams(window.location.search);
      if (!params.has('s') && !params.has('cfg')) {
        Draft.restore();
      }
    },
    clear: function () {
      if (state.draftTimer) {
        clearTimeout(state.draftTimer);
        state.draftTimer = null;
      }
      try {
        localStorage.removeItem(STORAGE_KEYS.DRAFT);
      } catch (e) {}
    },
    scheduleSave: function () {
      if (!Draft.isEnabled() || state._isRestoringDraft || window.isRestoringConfig) return;
      if (state.draftTimer) clearTimeout(state.draftTimer);
      state.draftTimer = setTimeout(function () {
        Draft.save();
      }, 500); // 防抖缩短至 500ms，保证手速快的用户刷新前迅速落盘
    },
    save: function () {
      if (!Draft.isEnabled() || state._isRestoringDraft || window.isRestoringConfig) return;
      var curCarId = state.currentCarId || (window._selectedCar ? window._selectedCar.id : null);
      if (!curCarId || curCarId === -1) {
        Draft.clear();
        return;
      }
      var draftData = {
        car_id: curCarId,
        params: ParamsIO.capture(),
        saved_at: Utils.now()
      };
      Utils.setStorage(STORAGE_KEYS.DRAFT, draftData);
    },
    restore: function () {
      if (!Draft.isEnabled()) return;
      var draft = Utils.getStorage(STORAGE_KEYS.DRAFT, null);
      if (draft && draft.car_id && draft.car_id !== -1 && draft.params) {
        var prevRestoring = window.isRestoringConfig;
        state._isRestoringDraft = true;
        window.isRestoringConfig = true;
        try {
          if (typeof window.setCalcMode === 'function' && draft.params.calc_mode && (draft.params.calc_mode === 'solo' || draft.params.calc_mode === 'team')) {
            window.setCalcMode(draft.params.calc_mode, true, true);
          }
          if (typeof window.pickCar === 'function') {
            window.pickCar(draft.car_id);
          }
          ParamsIO.apply(draft.params);
        } finally {
          window.isRestoringConfig = prevRestoring;
          state._isRestoringDraft = false;
        }
        if (typeof window.calculate === 'function') {
          window.calculate();
        }
        if (typeof window.__pvRefreshCollapse === 'function') {
          window.__pvRefreshCollapse(false);
        }
        CommunityPlans.toast('已自动恢复上次未保存的草稿');
      }
    }
  };

  // 代码层硬性规则过滤与校验器 (PlanValidator)
  var PlanValidator = {
    validate: function (params, title) {
      if (!title || !title.trim()) {
        return { valid: false, message: '请输入方案名称' };
      }
      var t = title.trim();
      if (Utils.charCount(t) > 15) {
        return { valid: false, message: '方案名称不能超过 15 个字' };
      }
      if (/^(.)\1{3,}\d*$/.test(t)) {
        return { valid: false, message: '【方案名称不合规】方案名称不能为纯连续重复字符 (如 aaaaa / aaaa1)，请输入有意义的方案名' };
      }
      if (/代练|代打|接单|出号|收号|加[vV微]|加[qQ扣]|微信|v信|威信|微信号|wx|vx|扣扣|qq群|企鹅群|私聊|有偿|包上分|上分车队|包赢|包国标|接单群|咸鱼|闲鱼|转转|拼多多|taobao|tb\.cn/i.test(t)) {
        return { valid: false, message: '【方案名称违规】方案名称检测到含有代练、出号、引流等违规词，已被代码层安全拦截' };
      }
      if (/[<>{}`\\]/.test(t) || /(ignore\s+(all\s+)?previous|system\s*prompt|assistant\s*:|role\s*:\s*system|<\|im_start\|>|<\|system\|>)/i.test(t)) {
        return { valid: false, message: '【方案名称不合规】方案名称包含非法特殊符号或敏感指令字符，请修改后重试' };
      }

      var p = params || {};

      var firstNitro = parseInt(p.first_nitro_count, 10) || 0;
      var loopNitro = parseInt(p.loop_nitro_count, 10) || 0;
      if (firstNitro < 0 || firstNitro > 5) {
        return { valid: false, message: '【首发氮气数异常】当前设定为 ' + firstNitro + ' 个氮气，超出对局合理上限 (最多 5 个)，请修改后再试' };
      }
      if (loopNitro < 0 || loopNitro > 8) {
        return { valid: false, message: '【循环氮气数异常】当前设定为 ' + loopNitro + ' 个氮气，超出对局合理上限 (最多 8 个)，请修改后再试' };
      }

      var xianji = parseFloat(p.xianji) || 0;
      var huineng = parseFloat(p.huineng) || 0;
      if (!isFinite(xianji) || xianji < 0 || xianji > 30) {
        return { valid: false, message: '【先机数值异常】当前输入为 ' + xianji + '%，超出比赛物理允许范围 (0% ~ 30%)，请核对后修改' };
      }
      if (!isFinite(huineng) || huineng < 0 || huineng > 60) {
        return { valid: false, message: '【汇能数值异常】当前输入为 ' + huineng + '%，超出赛车芯片槽位最大物理上限 (0% ~ 60%)，请核对后修改' };
      }

      if (p.has_extra_ult) {
        var ultFirst = parseFloat(p.val_extra_ult_first) || 0;
        var ultLoop = parseFloat(p.val_extra_ult_loop) || 0;
        if (!isFinite(ultFirst) || !isFinite(ultLoop) || ultFirst < 0 || ultLoop < 0 || ultFirst > 100 || ultLoop > 100) {
          return { valid: false, message: '额外大招充能数值异常 (合理范围 0% ~ 100%)' };
        }
      }
      if (p.has_extra_per_sec) {
        var perSec = parseFloat(p.val_extra_per_sec) || 0;
        if (!isFinite(perSec) || perSec < 0 || perSec > 100) {
          return { valid: false, message: '每秒自充数值异常 (合理范围 0% ~ 100%/s)' };
        }
      }
      if (p.val_custom_trig) {
        var trigFirst = parseInt(p.custom_trig_first, 10) || 0;
        var trigLoop = parseInt(p.custom_trig_loop, 10) || 0;
        if (!isFinite(trigFirst) || !isFinite(trigLoop) || trigFirst < 0 || trigLoop < 0 || trigFirst > 50 || trigLoop > 50) {
          return { valid: false, message: '自定义触发次数超出比赛合理范围 (0 ~ 50 次)' };
        }
      }

      return { valid: true };
    }
  };

  // 不再硬编码假国服方案，所有国服顶尖方案一律来自后端真实审核池
  var DefaultProPlans = [];

  // 核心对外模块
  var CommunityPlans = {
    init: function () {
      state.savedPlans = Utils.getStorage(STORAGE_KEYS.PLANS, []);
      state.votedMap = Utils.getStorage(STORAGE_KEYS.VOTES, {}) || {};
      state.proPlans = [];
      Utils.initFingerprintAsync();

      // 渲染挂载容器与面板骨架
      CommunityPlans.renderContainer();
      // 初始化自动草稿
      Draft.init();

      // 监听第三个模式 (support 辅助供能模式) - 发生变更时联动
      var getMode = function () {
        return (typeof window.getCalcMode === 'function')
          ? window.getCalcMode()
          : (document.body.getAttribute('data-calc-mode') || 'solo');
      };
      CommunityPlans.onModeChanged(getMode());

      try {
        var modeObserver = new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            if (m.type === 'attributes' && m.attributeName === 'data-calc-mode') {
              CommunityPlans.onModeChanged(getMode());
            }
          });
        });
        modeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-calc-mode'] });
      } catch (e) {}

      // 监听赛车选择
      if (window._selectedCar) {
        CommunityPlans.onCarChanged(window._selectedCar);
      } else {
        CommunityPlans.renderPlans();
      }

      // 页面初始化时主动拉取站点公告与运营配置（不依赖是否已选车），并静默核验本地待审方案真实状态
      CommunityPlans.fetchSiteConfig();
      CommunityPlans.loadNotifications();
      CommunityPlans.restoreOwnedOffline();
      CommunityPlans.syncOwnedPlans();
      CommunityPlans.syncPendingPlanStatuses({ force: true });

      if (!window.__cpStatusSyncBound) {
        window.__cpStatusSyncBound = true;
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) {
            CommunityPlans.syncOwnedPlans();
            CommunityPlans.syncPendingPlanStatuses();
          }
        });
        window.addEventListener('focus', function () {
          CommunityPlans.syncOwnedPlans();
          CommunityPlans.syncPendingPlanStatuses();
        });
        window.addEventListener('storage', function (event) {
          if (event.key !== 'arc_user_identity_v1' && event.key !== null) return;
          if (event.key && event.oldValue === event.newValue) return;
          // 立即撤销旧身份的本页显示与异步请求结果，随后按新身份重新同步。
          state._identityEpoch = (state._identityEpoch || 0) + 1;
          state._ownedMutationEpoch = (state._ownedMutationEpoch || 0) + 1;
          state._ownedSyncAt = 0;
          state._statusCursor = 0;
          state._lastStatusSyncAt = 0;
          state.currentIdentityHash = '';
          state.ownedRemoteIds = Object.create(null);
          state.identityApiReady = false;
          state.notifications = [];
          state.fetchSeq = (state.fetchSeq || 0) + 1;
          state.remotePlans = [];
          state.remotePage = 0;
          state.remoteHasMore = false;
          CommunityPlans.updateNotifBadge();
          CommunityPlans.renderPlans({ preserveScroll: true });
          CommunityPlans.restoreOwnedOffline();
          if (state._syncingOwned) state._resyncForIdentity = true;
          else CommunityPlans.syncOwnedPlans(true);
          if (state.currentCarId && state.currentCarId !== -1) CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1 });
        });
      }
    },

    // 模式变更联动 (第三个模式 support 辅助供能模式物理隐藏方案库)
    onModeChanged: function (mode) {
      var container = document.getElementById('communityPlansContainer');
      if (!container) return;
      if (mode === 'support') {
        container.style.display = 'none';
      } else {
        container.style.display = '';
        CommunityPlans.renderPlans();
      }
    },

    _triggerCopyBtnSuccess: function (btn) {
      if (!btn || !btn.classList) return;
      if (btn.__cpCopyTimer) clearTimeout(btn.__cpCopyTimer);
      btn.classList.add('is-copied');
      btn.__cpCopyTimer = setTimeout(function () {
        btn.classList.remove('is-copied');
        btn.__cpCopyTimer = null;
      }, 1400);
    },

    // 复制车手游戏 ID
    copyPlayerId: function (id, e) {
      if (e) e.stopPropagation();
      if (!id) return;
      var btn = e && (e.currentTarget || (e.target && e.target.closest && e.target.closest('.cp-player-id')));
      var strId = String(id);
      var onSuccess = function () {
        CommunityPlans._triggerCopyBtnSuccess(btn);
        CommunityPlans.toast('国服车手游戏ID 「' + strId + '」 已成功复制');
      };
      var fallbackCopy = function () {
        try {
          var ta = document.createElement('textarea');
          ta.value = strId;
          ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          var ok = document.execCommand && document.execCommand('copy');
          ta.remove();
          if (ok) { onSuccess(); return; }
        } catch (_) {}
        CommunityPlans.toast('车手游戏ID: ' + strId);
      };
      if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(strId).then(onSuccess).catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
    },

    // 卡片标题栏点击触发折叠/展开
    onTitleClick: function (e) {
      if (e && e.target && e.target.closest('button, input, a, .dropdown-menu')) {
        return;
      }
      CommunityPlans.toggleCollapse();
    },

    _captureActionsStart: function (card) {
      var bar = card && card.querySelector('.cp-actions-bar');
      if (!bar) return null;
      var titleEl = bar.parentElement;
      var gap = titleEl ? (parseFloat(getComputedStyle(titleEl).columnGap) || 8) : 8;
      if (card.classList.contains('pv-collapsed') && !bar.__cpActAnim) {
        return { fromZero: true, w: 0, ml: -gap, op: 0, tr: 'translateX(8px) scale(0.92)', gap: gap };
      }
      var cs = getComputedStyle(bar);
      var w = bar.getClientRects().length > 0 ? bar.getBoundingClientRect().width : 0;
      var ml = parseFloat(cs.marginLeft) || 0;
      var op = parseFloat(cs.opacity);
      if (isNaN(op)) op = w > 0 ? 1 : 0;
      var tr = (cs.transform && cs.transform !== 'none') ? cs.transform : 'translateX(0px) scale(1)';
      return { fromZero: w < 2, w: w, ml: ml, op: op, tr: tr, gap: gap };
    },

    _morphActionsBar: function (card, opening, instant, startSnap) {
      var bar = card && card.querySelector('.cp-actions-bar');
      if (!bar) return;

      var snap = startSnap || CommunityPlans._captureActionsStart(card);

      function clearAnim() {
        if (bar.__cpActAnim) {
          try { bar.__cpActAnim.cancel(); } catch (_) {}
          bar.__cpActAnim = null;
        }
        bar.style.overflow = '';
        bar.style.pointerEvents = '';
      }

      clearAnim();

      var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (instant || reduced || typeof bar.animate !== 'function' || !snap) {
        return;
      }

      if (opening) {
        var prevW = bar.style.width;
        bar.style.width = '';
        var w1 = bar.getBoundingClientRect().width;
        bar.style.width = prevW;
        if (w1 < 2) return;
        var startW = snap.fromZero ? 0 : snap.w;
        var startMl = snap.fromZero ? -snap.gap : snap.ml;
        var startOp = snap.fromZero ? 0 : snap.op;
        var startTr = snap.fromZero ? 'translateX(8px) scale(0.92)' : snap.tr;

        bar.style.overflow = 'hidden';
        bar.style.pointerEvents = 'none';
        var animOpen = bar.animate(
          [
            { width: startW + 'px', marginLeft: startMl + 'px', opacity: startOp, transform: startTr },
            { width: w1 + 'px', marginLeft: '0px', opacity: 1, transform: 'translateX(0px) scale(1)' }
          ],
          { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' }
        );
        bar.__cpActAnim = animOpen;
        animOpen.onfinish = function () {
          if (bar.__cpActAnim !== animOpen) return;
          clearAnim();
        };
      } else {
        if (snap.w < 2) return;
        bar.style.overflow = 'hidden';
        bar.style.pointerEvents = 'none';
        var animClose = bar.animate(
          [
            { width: snap.w + 'px', marginLeft: snap.ml + 'px', opacity: snap.op, transform: snap.tr },
            { width: '0px', marginLeft: (-snap.gap) + 'px', opacity: 0, transform: 'translateX(8px) scale(0.92)' }
          ],
          { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }
        );
        bar.__cpActAnim = animClose;
      }
    },

    // 切换折叠状态 (与全站 v4.js __pvMorph 规范 100% 同步：记录目标态避免重复触发，仅在收起终态才隐藏节点)
    toggleCollapse: function (forceState, instant) {
      var container = document.getElementById('communityPlansContainer');
      if (!container) return;
      var card = container.querySelector('.cp-plans-card') || container;
      var curShut = card.__pvA ? Boolean(card.__pvWant) : card.classList.contains('pv-collapsed');
      var isManualToggle = typeof forceState !== 'boolean';
      var shouldShut = isManualToggle ? !curShut : forceState;
      if (isManualToggle) {
        state.userCollapsed = shouldShut;
      }
      if (curShut === shouldShut && card.classList.contains('pv-shut') === shouldShut && !instant) {
        return;
      }
      var actStartSnap = CommunityPlans._captureActionsStart(card);
      card.__pvWant = shouldShut;
      card.classList.toggle('pv-shut', shouldShut);
      if (container !== card) container.classList.toggle('pv-shut', shouldShut);

      if (instant || typeof window.__pvMorph !== 'function') {
        if (card.__pvA) { card.__pvA.cancel(); card.__pvA = null; }
        if (card.__pvK) { card.__pvK.forEach(function (k) { k.cancel(); }); card.__pvK = null; }
        card.style.overflow = '';
        CommunityPlans._morphActionsBar(card, !shouldShut, true, actStartSnap);
        container.classList.toggle('pv-collapsed', shouldShut);
        card.classList.toggle('pv-collapsed', shouldShut);
        if (!shouldShut) {
          CommunityPlans._syncControlsBar(undefined, false);
          CommunityPlans._layoutTreeLines();
          CommunityPlans._scheduleTreeLayout();
        }
        return;
      }

      var kids = [].filter.call(card.children, function (k) {
        return !k.classList.contains('cp-card-title');
      });

      if (shouldShut) {
        window.__pvMorph(card, false, ['height'], kids, function () {
          card.classList.add('pv-collapsed');
          var h = card.getBoundingClientRect().height;
          card.classList.remove('pv-collapsed');
          return { height: h };
        }, function () {
          card.classList.add('pv-collapsed');
          if (container !== card) container.classList.add('pv-collapsed');
          CommunityPlans._morphActionsBar(card, false, true, actStartSnap);
        });
        CommunityPlans._morphActionsBar(card, false, false, actStartSnap);
      } else {
        window.__pvMorph(card, true, ['height'], kids, function () {
          card.classList.remove('pv-collapsed');
          if (container !== card) container.classList.remove('pv-collapsed');
          CommunityPlans._syncControlsBar(undefined, false);
          CommunityPlans._morphActionsBar(card, true, false, actStartSnap);
          CommunityPlans._layoutTreeLines();
          return { height: card.getBoundingClientRect().height };
        }, function () {
          CommunityPlans._scheduleTreeLayout();
        });
      }
    },

    scheduleDraftSave: function () {
      Draft.scheduleSave();
    },

    // 赛车变更联动
    onCarChanged: function (carOrId) {
      var prevCarId = state.currentCarId;
      if (!carOrId) {
        state.currentCarId = null;
        state.currentCar = null;
        state.remotePlans = [];
        state.remotePage = 1;
        state.remoteTotal = 0;
        state.remoteCategoryTotals = { partner: 0, pro: 0, community: 0 };
        state.remoteCategoryTotalsMode = state.filterMode || 'all';
        state.allCarTotal = 0;
        state.remoteTotalPages = 1;
        state.remoteHasMore = false;
        state.isLoadingMore = false;
      } else if (typeof carOrId === 'object') {
        state.currentCarId = carOrId.id;
        state.currentCar = carOrId;
      } else {
        state.currentCarId = carOrId;
        var db = (typeof CAR_DATABASE !== 'undefined') ? CAR_DATABASE : (window.CAR_DATABASE || []);
        if (Array.isArray(db)) {
          state.currentCar = db.find(function (c) { return c.id === carOrId; }) || null;
        }
      }
      if (prevCarId !== state.currentCarId) {
        state.remotePlans = [];
        state.remotePage = 1;
        state.remoteTotal = 0;
        state.remoteCategoryTotals = { partner: 0, pro: 0, community: 0 };
        state.remoteCategoryTotalsMode = state.filterMode || 'all';
        state.allCarTotal = 0;
        state.remoteTotalPages = 1;
        state.remoteHasMore = false;
        state.isLoadingMore = false;
        state.officialChips = (state.currentCarId && state.officialChipsByCar[String(state.currentCarId)]) || null;
        state.isFetchingOfficial = false;
      }
      if (prevCarId !== state.currentCarId && !state._isRestoringDraft && !window.isRestoringConfig) {
        state.lastSnapshot = null;
        state.hasUndoAvailable = false;
        state.activeAppliedPlanId = null;
        state.appliedSource = null;
        var undoBtn = document.getElementById('cpBtnUndo');
        if (undoBtn) undoBtn.style.display = 'none';
      }
      if (state.currentCarId && state.currentCarId !== -1) {
        CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false });
        CommunityPlans.fetchOfficialChips(state.currentCarId);
        CommunityPlans.syncPendingPlanStatuses();
        // 切车后立即覆盖更新新车的洁净草稿，避免旧车改动残留并在未满防抖期刷新时复现
        if (!state._isRestoringDraft && !window.isRestoringConfig) {
          Draft.save();
        }
      } else if (!state._isRestoringDraft && !window.isRestoringConfig) {
        Draft.clear();
      }
      CommunityPlans.renderPlans();
    },

    _normalizeRemoteItem: function (rp) {
      var localUpdated = false;
      var votesUpdated = false;
      var matchedLocal = state.savedPlans.find(function (lp) {
        return rp.viewer_is_author && lp.remote_id && lp.remote_id === rp.id;
      });
      if (matchedLocal) {
        if (matchedLocal.remote_status !== 'approved') {
          matchedLocal.remote_status = 'approved';
          localUpdated = true;
        }
        if (rp.is_pro && !matchedLocal.isPro) {
          matchedLocal.isPro = true;
          localUpdated = true;
        }
        if (rp.is_partner && !matchedLocal.isPartner) {
          matchedLocal.isPartner = true;
          localUpdated = true;
        }
        if (typeof rp.votes === 'number' && matchedLocal.votes !== rp.votes) {
          matchedLocal.votes = rp.votes;
          localUpdated = true;
        }
      }
      if (typeof rp.viewer_has_voted === 'boolean') {
        rp.isVoted = rp.viewer_has_voted;
        if (rp.viewer_has_voted) {
          if (!state.votedMap[rp.id]) {
            state.votedMap[rp.id] = 1;
            votesUpdated = true;
          }
        } else if (state.votedMap[rp.id]) {
          delete state.votedMap[rp.id];
          votesUpdated = true;
        }
      } else {
        rp.isVoted = Boolean(state.votedMap[rp.id]);
      }
      rp.viewer_is_author = Boolean(rp.viewer_is_author);
      return { item: rp, localUpdated: localUpdated, votesUpdated: votesUpdated };
    },

    _updateLazyFooterDom: function () {
      var footer = document.getElementById('cpLazySentinel');
      if (!footer) return;
      var statusEl = footer.querySelector('.cp-lazy-status');
      var btnEl = footer.querySelector('.cp-lazy-btn');
      if (statusEl && state.isLoadingMore) {
        statusEl.textContent = '正在懒加载更多方案 (' + state.remotePlans.length + ' / ' + Math.max(state.remoteTotal, state.remotePlans.length) + ')...';
      }
      if (btnEl) {
        btnEl.disabled = state.isLoadingMore;
        btnEl.textContent = state.isLoadingMore ? '加载中...' : '加载更多';
      }
    },

    bindLazyScroll: function () {
      if (state._lazyObserver) {
        try { state._lazyObserver.disconnect(); } catch (_) {}
        state._lazyObserver = null;
      }
      var vp = document.getElementById('cpScrollViewport');
      var sentinel = document.getElementById('cpLazySentinel');
      if (!vp) return;

      var maybeLoadMore = function () {
        if (!state.remoteHasMore || state.isLoadingMore || state.isFetchingRemote) return;
        CommunityPlans.loadMoreRemotePlans();
      };

      vp.addEventListener('scroll', function () {
        if (!state.remoteHasMore || state.isLoadingMore || state.isFetchingRemote) return;
        if (vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 90) {
          maybeLoadMore();
        }
      }, { passive: true });

      if (sentinel && state.remoteHasMore && typeof IntersectionObserver === 'function') {
        try {
          state._lazyObserver = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i += 1) {
              if (entries[i].isIntersecting) {
                maybeLoadMore();
                break;
              }
            }
          }, { root: vp, rootMargin: '90px 0px', threshold: 0.01 });
          state._lazyObserver.observe(sentinel);
        } catch (_) {}
      }
    },

    loadMoreRemotePlans: function () {
      if (!state.currentCarId || state.currentCarId === -1) return;
      if (!state.remoteHasMore || state.isLoadingMore || state.isFetchingRemote) return;
      CommunityPlans.fetchRemotePlans(state.currentCarId, {
        page: (state.remotePage || 1) + 1,
        append: true,
        preserveScroll: true
      });
    },

    // 异步从私有后端 Serverless 拉取社区已审核方案（支持分批懒加载）
    fetchRemotePlans: function (carId, opts) {
      if (!carId || carId === -1) return;
      var options = opts || {};
      var targetPage = Math.max(1, parseInt(options.page, 10) || 1);
      var append = Boolean(options.append);
      var preserveScroll = Boolean(options.preserveScroll || append);
      var reqSeq;

      if (append) {
        if (state.isLoadingMore || !state.remoteHasMore) return;
        reqSeq = state.fetchSeq;
        state.isLoadingMore = true;
        CommunityPlans._updateLazyFooterDom();
      } else {
        state.fetchSeq = (state.fetchSeq || 0) + 1;
        reqSeq = state.fetchSeq;
        state.isFetchingRemote = true;
        state.isLoadingMore = false;
      }

      var sortParam = state.sortMode || 'hot';
      var calcModeParam = state.filterMode || 'all';
      var pageSize = state.remotePageSize || 8;
      var url = '/api/plans?car_id=' + encodeURIComponent(carId) +
        '&sort_by=' + encodeURIComponent(sortParam) +
        '&calc_mode=' + encodeURIComponent(calcModeParam) +
        '&page=' + encodeURIComponent(targetPage) +
        '&limit=' + encodeURIComponent(pageSize);

      var requestHeaders = Utils.getApiHeaders(false);
      var requestIdentity = requestHeaders['X-User-Identity'] || '';
      var requestIdentityEpoch = state._identityEpoch || 0;
      fetch(url, {
        method: 'GET',
        headers: requestHeaders
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok || !resObj.data) {
            var err = new Error('HTTP ' + resObj.status);
            err.httpStatus = resObj.status;
            err.userMsg = (resObj.data && resObj.data.message) ? resObj.data.message : '';
            throw err;
          }
          var json = resObj.data;
          if (reqSeq !== state.fetchSeq || String(carId) !== String(state.currentCarId) || (state._identityEpoch || 0) !== requestIdentityEpoch || (requestIdentity && !Utils.identityMatches(requestIdentity))) return;
          if (json && json.site_meta && typeof json.site_meta === 'object') {
            state.siteMeta = Object.assign({}, state.siteMeta, json.site_meta);
            CommunityPlans.maybeHandleAnnouncement(false);
          }
          if (json && json.success && json.data && Array.isArray(json.data.items)) {
            var anyLocalUpdated = false;
            var anyVotesUpdated = false;
            var normalized = json.data.items.map(function (rp) {
              var out = CommunityPlans._normalizeRemoteItem(rp);
              if (out.localUpdated) anyLocalUpdated = true;
              if (out.votesUpdated) anyVotesUpdated = true;
              return out.item;
            });

            if (append) {
              var existingMap = {};
              state.remotePlans.forEach(function (ep) { existingMap[ep.id] = true; });
              normalized.forEach(function (np) {
                if (!existingMap[np.id]) {
                  state.remotePlans.push(np);
                  existingMap[np.id] = true;
                }
              });
            } else {
              state.remotePlans = normalized;
            }

            state.remotePage = Number(json.data.page) || targetPage;
            state.remoteTotal = Math.max(state.remotePlans.length, Number(json.data.total) || 0);
            if (calcModeParam === 'all') {
              state.allCarTotal = Math.max(state.allCarTotal, state.remoteTotal);
            }
            state.remoteTotalPages = Math.max(1, Number(json.data.total_pages) || Math.ceil(state.remoteTotal / pageSize) || 1);
            state.remoteHasMore = typeof json.data.has_more === 'boolean'
              ? json.data.has_more
              : (state.remotePage * pageSize < state.remoteTotal);
            var ct = json.data.category_totals;
            if (ct && typeof ct === 'object') {
              state.remoteCategoryTotals = {
                partner: Number(ct.partner) || 0,
                pro: Number(ct.pro) || 0,
                community: Number(ct.community) || 0
              };
              state.remoteCategoryTotalsMode = calcModeParam;
            }

            if (anyLocalUpdated) {
              Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            }
            if (anyVotesUpdated) {
              Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
            }
            if (append) state.isLoadingMore = false;
            else state.isFetchingRemote = false;
            CommunityPlans.renderPlans({ preserveScroll: preserveScroll });
          }
        })
        .catch(function (err) {
          if (reqSeq !== state.fetchSeq) return;
          if (append) state.isLoadingMore = false;
          else state.isFetchingRemote = false;
          // 离线或服务暂时未连通时降级展示本地与已缓存方案；明确限流/拦截时给出轻提示
          console.log('[CommunityPlans] 社区方案拉取降级:', err.message);
          if (err && (err.httpStatus === 429 || err.httpStatus === 403) && err.userMsg) {
            CommunityPlans.toast(err.userMsg);
          }
          CommunityPlans.renderPlans({ preserveScroll: preserveScroll });
        })
        .finally(function () {
          if (reqSeq === state.fetchSeq) {
            if (append) state.isLoadingMore = false;
            else state.isFetchingRemote = false;
          }
        });
    },

    // 拉取官方 AI 推荐芯片数据（带按车型内存缓存，避免重复请求）
    fetchOfficialChips: function (carId) {
      if (!carId || carId === -1) return;
      var key = String(carId);
      if (state.officialChipsByCar[key]) {
        state.officialChips = state.officialChipsByCar[key];
        state.isFetchingOfficial = false;
        CommunityPlans.renderPlans({ preserveScroll: true });
        return;
      }

      state.officialFetchSeq = (state.officialFetchSeq || 0) + 1;
      var reqSeq = state.officialFetchSeq;
      state.isFetchingOfficial = true;

      fetch('/api/plans?official=1&car_id=' + encodeURIComponent(key), {
        method: 'GET',
        headers: Utils.getApiHeaders(false)
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (reqSeq !== state.officialFetchSeq || String(state.currentCarId) !== key) return;
          state.isFetchingOfficial = false;
          if (resObj && resObj.ok && resObj.data && resObj.data.success && resObj.data.data) {
            var payload = resObj.data.data;
            state.officialChipsByCar[key] = payload;
            state.officialChips = payload;
            CommunityPlans.renderPlans({ preserveScroll: true });
          }
        })
        .catch(function (err) {
          if (reqSeq !== state.officialFetchSeq) return;
          state.isFetchingOfficial = false;
          console.log('[CommunityPlans] 官方AI推荐拉取降级:', err && err.message ? err.message : err);
        });
    },

    switchOfficialTier: function (tierKey) {
      if (!tierKey || state.officialTier === tierKey) return;
      state.officialTier = tierKey;
      CommunityPlans.renderPlans({ preserveScroll: true });
    },

    applyOfficialPlan: function (tierKey) {
      var data = state.officialChips;
      var activeTier = tierKey || state.officialTier || '16-99';
      var ailab = data && data.ailab ? data.ailab : null;
      var tierWeights = (ailab && ailab[activeTier]) || (ailab && ailab['16-99']) || null;
      if (!tierWeights || Object.keys(tierWeights).length === 0) {
        CommunityPlans.toast('当前车型暂无可套用的官方 AI 推荐数据');
        return;
      }

      var curCalcMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      var derived = buildOfficialDerivedParams(tierWeights, state.currentCar, curCalcMode);

      state.lastSnapshot = ParamsIO.capture();
      state.hasUndoAvailable = true;
      state.activeAppliedPlanId = '__official_' + activeTier;
      state.appliedSource = null;

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'inline-flex';

      ParamsIO.apply(derived.params);
      CommunityPlans.renderPlans({ preserveScroll: true });
      Draft.scheduleSave();

      var cardChips = document.getElementById('cardChips');
      if (cardChips) {
        cardChips.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      var summaryParts = [];
      if (derived.xianji > 0) summaryParts.push('先机 ' + derived.xianji + '%');
      if (derived.huineng > 0) summaryParts.push('汇能 ' + derived.huineng + '%');
      if (curCalcMode === 'team' && derived.tuanhun > 0) summaryParts.push('团魂 ' + derived.tuanhun + '%');
      var sumTxt = summaryParts.length > 0 ? ('（' + summaryParts.join(' · ') + '）') : '';
      CommunityPlans.toast('已按槽位套用官方 AI 推荐配比' + sumTxt);
    },

    _hasOfficialData: function () {
      if (state.siteMeta && state.siteMeta.official_chips_enabled === false) return false;
      var d = state.officialChips;
      if (!d || !d.available || d.disabled) return false;
      var hasAilab = d.ailab && Object.keys(d.ailab).some(function (k) {
        return d.ailab[k] && Object.keys(d.ailab[k]).length > 0;
      });
      var hasStats = Array.isArray(d.stats) && d.stats.length > 0;
      return Boolean(hasAilab || hasStats);
    },

    _pickOfficialWeights: function (ailab) {
      if (!ailab || typeof ailab !== 'object') return {};
      if (ailab['16-99'] && Object.keys(ailab['16-99']).length > 0) return ailab['16-99'];
      var keys = Object.keys(ailab);
      for (var i = 0; i < keys.length; i++) {
        if (ailab[keys[i]] && Object.keys(ailab[keys[i]]).length > 0) return ailab[keys[i]];
      }
      return {};
    },

    _renderOfficialChipIcon: function (info) {
      if (info && info.iconFile) {
        return '<img src="data/icon/official/' + Utils.escapeHtml(info.iconFile) + '" class="cp-off-chip-img" alt="" loading="lazy">';
      }
      if (info && info.calcId) {
        var def = typeof window._chipDef === 'function' ? window._chipDef(info.calcId) : null;
        var icon = def && def.icon ? def.icon : 'chip_' + info.calcId + '.png';
        return '<img src="data/icon/' + Utils.escapeHtml(icon) + '" class="cp-off-chip-img" alt="" loading="lazy">';
      }
      var sym = (info && info.shape) ? String(info.shape) : '';
      if (sym.indexOf('V') >= 0) sym = 'V';
      else if (sym.indexOf('\u25C7') >= 0 && sym.indexOf('\u25B3') < 0) sym = '\u25C7';
      else if (sym.indexOf('\u25B3') >= 0) sym = '\u25B3';
      else if (sym.indexOf('\u25E3') >= 0 || sym.indexOf('⬡') >= 0) sym = '\u25E3';
      else sym = '\u25CB';
      if (typeof window.__pvChip === 'function') {
        return '<span class="cp-off-pv-chip">' + window.__pvChip(sym) + '</span>';
      }
      return '<span class="cp-off-chip-fallback">' + Utils.escapeHtml(sym) + '</span>';
    },

    renderOfficialSection: function (calcMode) {
      var d = state.officialChips;
      if (!CommunityPlans._hasOfficialData()) return '';

      var tierWeights = CommunityPlans._pickOfficialWeights(d.ailab);
      var entries = Object.keys(tierWeights).map(function (cid) {
        return { id: cid, weight: Number(tierWeights[cid]) || 0, info: getOfficialChipInfo(cid) };
      }).filter(function (x) { return x.weight > 0.001; });
      entries.sort(function (a, b) { return b.weight - a.weight; });

      var maxW = entries.length > 0 ? Math.max(entries[0].weight, 0.01) : 1;
      var topEntries = entries.slice(0, 8);
      var derived = buildOfficialDerivedParams(tierWeights, state.currentCar, calcMode);
      var isApplied = (state.activeAppliedPlanId === '__official_16-99');

      // 1. 复用原版高亮行 .cp-specs-hl-row（先机 / 汇能 / 团魂 / 适配核心）
      var hlCells = [];
      if (Object.keys(tierWeights).length > 0) {
        hlCells.push({ lbl: '先机（按槽位换算）', val: derived.xianji + '%' });
        hlCells.push({ lbl: '汇能（按槽位换算）', val: derived.huineng + '%' });
        if (calcMode === 'team') {
          hlCells.push({ lbl: '团魂（按槽位换算）', val: derived.tuanhun + '%' });
        }
      }
      var hlRowHtml = hlCells.length > 0
        ? '<div class="cp-specs-hl-row" style="--hl-cols:' + hlCells.length + '">' +
            hlCells.map(function (c) {
              return '<div class="cp-spec-hl-cell"><span class="cp-spec-lbl">' + Utils.escapeHtml(c.lbl) + '</span><span class="cp-spec-val is-acc">' + Utils.escapeHtml(c.val) + '</span></div>';
            }).join('') +
          '</div>'
        : '';

      // 2. 复用原版网格 .cp-specs-grid 展示高权重推荐芯片 + 网站自带芯片图标
      var chipCellsHtml = topEntries.map(function (item) {
        var pct = Math.min(100, Math.round((item.weight / maxW) * 100));
        var wText = item.weight >= 1 ? item.weight.toFixed(2) : item.weight.toFixed(3);
        var titleAttr = item.info.desc ? (' title="' + Utils.escapeHtml(item.info.desc + '（推荐权重 ' + wText + '）') + '"') : '';
        return '<div class="cp-spec-cell cp-off-chip-cell"' + titleAttr + '>' +
          '<div class="cp-off-chip-progress" style="width:' + pct + '%"></div>' +
          '<div class="cp-off-chip-row">' +
            CommunityPlans._renderOfficialChipIcon(item.info) +
            '<span class="cp-off-chip-label">' + Utils.escapeHtml(item.info.name) + '</span>' +
            '<span class="cp-off-chip-score">' + wText + '</span>' +
          '</div>' +
        '</div>';
      }).join('');

      var chipGridHtml = chipCellsHtml
        ? '<div class="cp-specs-grid cp-off-specs-grid">' + chipCellsHtml + '</div>'
        : '<div class="cp-card-note-box"><span class="cp-note-text">该车型暂无 AI 芯片权重数据</span></div>';

      // 3. 复用原版扩展行 .cp-specs-extra 展示适配核心与实战胜率统计
      var extraRows = [];
      if (derived.chipsOn.length > 0) {
        extraRows.push({
          k: '核心',
          v: derived.chipsOn.map(function (c) { return CHIP_NAME_MAP[c.id] || c.id; }).join(' · '),
          acc: true
        });
      }
      var showStats = !(state.siteMeta && state.siteMeta.official_chips_show_stats === false);
      if (showStats && Array.isArray(d.stats) && d.stats.length > 0) {
        var topStats = d.stats.slice().sort(function (a, b) {
          return (Number(b.all_cnt) || 0) - (Number(a.all_cnt) || 0);
        }).slice(0, 3);
        var statsText = topStats.map(function (st) {
          var wr = Number(st.win_rate) || 0;
          var cnt = Number(st.all_cnt) || 0;
          var cntTxt = cnt >= 10000 ? ((cnt / 10000).toFixed(1) + '万场') : (cnt + '场');
          return '组合#' + String(st.plan_key || '') + ' 胜率' + wr + '%(' + cntTxt + ')';
        }).join(' · ');
        extraRows.push({ k: '实战', v: statsText, acc: false });
      }
      var extraHtml = extraRows.length > 0
        ? '<div class="cp-specs-extra">' + extraRows.map(function (r) {
            return '<div class="cp-spec-extra-row"><span class="cp-spec-extra-k">' + Utils.escapeHtml(r.k) + '</span><span class="cp-spec-extra-v' + (r.acc ? ' is-acc' : '') + '">' + Utils.escapeHtml(r.v) + '</span></div>';
          }).join('') + '</div>'
        : '';

      return [
        '<div class="cp-section cp-section-official">',
        '  <div class="cp-sec-header">',
        '    <div class="cp-sec-icon-box">' + Icons.aiSpark + '</div>',
        '    <div class="cp-sec-info">',
        '      <div class="cp-sec-title-row">',
        '        <span class="cp-sec-title"><span class="zh">官方 AI 推荐</span><span class="lang-en">Official AI Recommended</span></span>',
        '        <span class="cp-sec-count">1</span>',
        '      </div>',
        '      <div class="cp-sec-desc"><span class="zh">官方大数据芯片推荐（自动按当前车型槽位换算可套用参数）</span><span class="lang-en">Official AI chip recommendations</span></div>',
        '    </div>',
        '  </div>',
        '  <div class="cp-sec-list">',
        '    <article class="cp-card-item cp-official-item' + (isApplied ? ' is-applied' : '') + '">',
        '      <div class="cp-card-head">',
        '        <div class="cp-card-header-line">',
        '          <h4 class="cp-card-title"><span class="zh">官方 AI 大数据推荐配装</span><span class="lang-en">Official AI Setup</span></h4>',
        '          <div class="cp-card-badges">',
        '            <span class="cp-card-badge cp-badge-official">' + Icons.aiSpark + ' 官方推荐</span>',
        (isApplied ? '            <span class="cp-card-badge cp-badge-active">' + Icons.check + ' 生效中</span>' : ''),
        '          </div>',
        '        </div>',
        '      </div>',
        '      <div class="cp-specs-panel">',
        hlRowHtml,
        chipGridHtml,
        extraHtml,
        '      </div>',
        '      <div class="cp-card-foot">',
        '        <div class="cp-foot-left"><span class="cp-meta-time">按权重与槽位自动换算</span></div>',
        (Object.keys(tierWeights).length > 0
          ? ('        <button type="button" class="nav-btn cp-apply-btn' + (isApplied ? ' is-applied' : '') + '">' +
             (isApplied ? Icons.check : Icons.apply) + '<span class="zh">' + (isApplied ? '已套用' : '一键套用') + '</span><span class="lang-en">' + (isApplied ? 'Applied' : 'Apply') + '</span></button>')
          : ''),
        '      </div>',
        '    </article>',
        '  </div>',
        '</div>'
      ].join('');
    },

    // 渲染挂载容器与面板骨架 (严格挂载于选择车辆卡片正下方)
    renderContainer: function () {
      var container = document.getElementById('communityPlansContainer');
      if (!container) {
        var heroLayout = document.querySelector('.desktop-layout.cp-hero');
        if (heroLayout && heroLayout.parentNode) {
          container = document.createElement('div');
          container.id = 'communityPlansContainer';
          heroLayout.parentNode.insertBefore(container, heroLayout.nextSibling);
        }
      }
      if (!container) return;

      // 100% 融入宿主 .card 体系，天然继承毛玻璃、半透明与边框高光，并支持 .pv-collapsible 折叠能力
      container.className = 'card cp-plans-card pv-collapsible';
      container.innerHTML = [
        '<div class="card-title cp-card-title" title="点击折叠/展开方案库">',
        '  <div class="cp-title-left">',
        '    <span class="cp-badge-icon" aria-hidden="true">' + Icons.chip + '</span>',
        '    <span class="cp-title-text"><span class="zh">芯片方案库</span><span class="lang-en">Chip Setups</span></span>',
        '    <span id="cpCurrentCarBadge" class="cp-car-badge"><span class="zh">未选赛车</span><span class="lang-en">No Car Selected</span></span>',
        '  </div>',
        '  <div class="cp-actions-bar">',
        '    <button type="button" id="cpBtnUndo" class="nav-btn cp-btn cp-btn-undo" style="display:none;" title="撤销套用 / Undo" aria-label="撤销套用 / Undo">',
        '      ' + Icons.undo + '<span class="cp-btn-label"><span class="zh">撤销套用</span><span class="lang-en">Undo</span></span>',
        '    </button>',
        '    <button type="button" class="nav-btn cp-btn cp-btn-save" title="保存当前配装 / Save Setup" aria-label="保存当前配装 / Save Setup">',
        '      ' + Icons.save + '<span class="cp-btn-label"><span class="zh">保存当前配装</span><span class="lang-en">Save Setup</span></span>',
        '    </button>',
        '  </div>',
        '  <button type="button" class="nav-btn select-btn cp-icon-btn cp-fold-btn" title="折叠/展开方案库">',
        '    <span class="cp-fold-indicator" aria-hidden="true">' + Icons.chevron + '</span>',
        '  </button>',
        '</div>',
        '<div id="cpFixedHeader" class="cp-fixed-header">',
        '  <div id="cpBannerSlot" style="display:none;"></div>',
        '  <div id="cpControlsBarSlot" class="cp-controls-bar" style="display:none;">',
        '    <div class="cp-ctrl-group">',
        '      <span class="cp-controls-hint">模式筛选</span>',
        '      <div id="cpFilterSeg" class="cp-seg-track" role="radiogroup" aria-label="方案模式筛选">',
        '        <span class="cp-seg-thumb" aria-hidden="true"></span>',
        '        <button type="button" class="cp-seg-btn is-on" data-val="all">全部</button>',
        '        <button type="button" class="cp-seg-btn" data-val="solo">先机汇能</button>',
        '        <button type="button" class="cp-seg-btn" data-val="team">团魂获能</button>',
        '      </div>',
        '    </div>',
        '    <div class="cp-ctrl-group">',
        '      <span class="cp-controls-hint">排序</span>',
        '      <div id="cpSortSeg" class="cp-seg-track" role="radiogroup" aria-label="方案排序">',
        '        <span class="cp-seg-thumb" aria-hidden="true"></span>',
        '        <button type="button" class="cp-seg-btn is-on" data-val="hot">最热</button>',
        '        <button type="button" class="cp-seg-btn" data-val="latest">最新</button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>',
        '<div id="cpSectionsStream" class="cp-sections-stream"></div>'
      ].join('');

      // 这些节点来自上面的固定模板，在插入后立即逐个绑定，不接受 data 属性作为动作授权。
      container.querySelector('.cp-card-title').addEventListener('click', function (event) { CommunityPlans.onTitleClick(event); });
      container.querySelector('.cp-actions-bar').addEventListener('click', function (event) { event.stopPropagation(); });
      container.querySelector('#cpBtnUndo').addEventListener('click', function () { CommunityPlans.undoApply(); });
      container.querySelector('.cp-actions-bar .cp-btn-save').addEventListener('click', function () { CommunityPlans.openSaveModal(); });
      container.querySelector('.cp-fold-btn').addEventListener('click', function (event) { event.stopPropagation(); CommunityPlans.toggleCollapse(); });
      ['all', 'solo', 'team'].forEach(function (mode, i) {
        container.querySelectorAll('#cpFilterSeg .cp-seg-btn')[i].addEventListener('click', function () { CommunityPlans.setFilterMode(mode); });
      });
      ['hot', 'latest'].forEach(function (mode, i) {
        container.querySelectorAll('#cpSortSeg .cp-seg-btn')[i].addEventListener('click', function () { CommunityPlans.setSortMode(mode); });
      });

      if (!window.__cpResizeSegBound) {
        window.__cpResizeSegBound = true;
        window.addEventListener('resize', function () {
          CommunityPlans._syncControlsBar(undefined, false);
        });
      }
    },

    _syncSegThumb: function (trackId, activeVal, animate) {
      var track = document.getElementById(trackId);
      if (!track) return;
      var thumb = track.querySelector('.cp-seg-thumb');
      var btns = track.querySelectorAll('.cp-seg-btn');
      var activeBtn = null;
      for (var i = 0; i < btns.length; i += 1) {
        var isMatch = btns[i].getAttribute('data-val') === activeVal;
        btns[i].classList.toggle('is-on', isMatch);
        btns[i].setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        if (isMatch) activeBtn = btns[i];
      }
      if (!thumb || !activeBtn || track.offsetWidth === 0 || activeBtn.offsetWidth === 0) return;

      var nextW = activeBtn.offsetWidth + 'px';
      var nextH = activeBtn.offsetHeight + 'px';
      var nextT = 'translate3d(' + activeBtn.offsetLeft + 'px, ' + activeBtn.offsetTop + 'px, 0)';
      var wasReady = thumb.classList.contains('is-ready');
      if (wasReady && thumb.style.width === nextW && thumb.style.height === nextH && thumb.style.transform === nextT) {
        return;
      }
      var useAnim = Boolean(animate && wasReady);
      if (!useAnim) {
        thumb.classList.add('no-anim');
      } else {
        thumb.classList.remove('no-anim');
      }

      thumb.style.width = nextW;
      thumb.style.height = nextH;
      thumb.style.transform = nextT;
      thumb.classList.add('is-ready');

      if (!useAnim) {
        void thumb.offsetWidth;
        thumb.classList.remove('no-anim');
      }
    },

    _syncHeaderActions: function (showSave) {
      var bar = document.querySelector('#communityPlansContainer .cp-actions-bar');
      if (!bar) return;
      var card = bar.closest('.cp-plans-card');
      var isCollapsed = !!(card && card.classList.contains('pv-collapsed'));
      var barWasHidden = bar.style.display === 'none';
      var saveBtn = bar.querySelector('.cp-btn-save');
      var saveWasHidden = !!(saveBtn && saveBtn.style.display === 'none');
      var undoBtn = document.getElementById('cpBtnUndo');
      if (saveBtn) saveBtn.style.display = showSave ? '' : 'none';
      var hasUndo = Boolean(undoBtn && undoBtn.style.display !== 'none');
      var barWillShow = Boolean(showSave || hasUndo);
      bar.style.display = barWillShow ? '' : 'none';
      if (!isCollapsed && cpMotionOK()) {
        if (barWasHidden && barWillShow && typeof bar.animate === 'function') {
          bar.animate(
            [
              { opacity: 0, transform: 'translateX(6px) scale(0.96)' },
              { opacity: 1, transform: 'translateX(0) scale(1)' }
            ],
            { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
          );
        } else if (!barWasHidden && saveWasHidden && showSave && saveBtn && typeof saveBtn.animate === 'function') {
          saveBtn.animate(
            [
              { opacity: 0, transform: 'translateX(6px) scale(0.96)' },
              { opacity: 1, transform: 'translateX(0) scale(1)' }
            ],
            { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
          );
        }
      }
    },

    _syncControlsBar: function (showControls, animate) {
      var bar = document.getElementById('cpControlsBarSlot');
      if (!bar) return;
      if (typeof showControls === 'boolean') {
        var wasVisible = bar.style.display !== 'none';
        bar.style.display = showControls ? '' : 'none';
        if (!showControls) return;
        if (!wasVisible) {
          animate = false;
          var card = bar.closest('.cp-plans-card');
          var isCollapsed = !!(card && card.classList.contains('pv-collapsed'));
          if (!isCollapsed && cpMotionOK() && typeof bar.animate === 'function') {
            bar.animate(
              [
                { opacity: 0, transform: 'translateY(-6px)' },
                { opacity: 1, transform: 'translateY(0)' }
              ],
              { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
          }
        }
      } else if (bar.style.display === 'none') {
        return;
      }
      CommunityPlans._syncSegThumb('cpFilterSeg', state.filterMode || 'all', animate);
      CommunityPlans._syncSegThumb('cpSortSeg', state.sortMode || 'hot', animate);
    },

    // 切换列表排序（最热 / 最新）
    setSortMode: function (mode) {
      var nextMode = mode === 'latest' ? 'latest' : 'hot';
      if (state.sortMode === nextMode) return;
      state.sortMode = nextMode;
      CommunityPlans._syncControlsBar(true, true);
      state.remotePlans = [];
      state.remotePage = 1;
      state.remoteTotal = 0;
      state.remoteTotalPages = 1;
      state.remoteHasMore = false;
      state.isLoadingMore = false;
      if (state.currentCarId && state.currentCarId !== -1) {
        CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false });
      }
      CommunityPlans.renderPlans();
    },

    // 切换模式筛选（全部 / 先机汇能 / 团魂获能）
    setFilterMode: function (mode) {
      var nextMode = (mode === 'solo' || mode === 'team') ? mode : 'all';
      if (state.filterMode === nextMode) return;
      state.filterMode = nextMode;
      CommunityPlans._syncControlsBar(true, true);
      state.remotePlans = [];
      state.remotePage = 1;
      state.remoteTotal = 0;
      state.remoteTotalPages = 1;
      state.remoteHasMore = false;
      state.isLoadingMore = false;
      if (state.currentCarId && state.currentCarId !== -1) {
        CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false });
      }
      CommunityPlans.renderPlans();
    },

    // 渲染方案卡片列表 (固定高度滚动窗口 + 懒加载追加)
    renderPlans: function (opts) {
      var renderOpts = opts || {};
      var prevViewport = document.getElementById('cpScrollViewport');
      var savedScrollTop = (renderOpts.preserveScroll && prevViewport) ? prevViewport.scrollTop : 0;

      var badge = document.getElementById('cpCurrentCarBadge');
      var stream = document.getElementById('cpSectionsStream');
      var container = document.getElementById('communityPlansContainer');
      if (!stream || !container) return;

      // 1. 第三个模式 (support 辅助供能模式) 物理隐藏方案库
      var currentMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      if (currentMode === 'support') {
        container.style.display = 'none';
        return;
      } else {
        container.style.display = '';
      }

      var carName = state.currentCar ? (state.currentCar.name || '未知') : '未选赛车';

      // 2. 未选赛车状态 -> 隐藏控制栏；默认保持展开，仅当用户手动收起时才保持折叠
      if (!state.currentCarId || state.currentCarId === -1) {
        var bannerSlotEmpty = document.getElementById('cpBannerSlot');
        if (bannerSlotEmpty) {
          bannerSlotEmpty.style.display = 'none';
          bannerSlotEmpty.innerHTML = '';
        }
        CommunityPlans._syncControlsBar(false, false);
        CommunityPlans._syncHeaderActions(false);
        if (badge) {
          badge.innerHTML = '<span class="zh">未选赛车</span><span class="lang-en">No Car Selected</span>';
        }
        stream.innerHTML = [
          '<div class="cp-empty-box">',
          '  ' + Icons.emptyCar,
          '  <div class="cp-empty-title"><span class="zh">请先在上方选择一辆赛车</span><span class="lang-en">Select a Car Above</span></div>',
          '  <div class="cp-empty-desc"><span class="zh">选好赛车后，这里将直接为您垂直呈现本地方案、国服精选与社区推荐</span><span class="lang-en">Select a car to view setups</span></div>',
          '</div>'
        ].join('');
        CommunityPlans.toggleCollapse(Boolean(state.userCollapsed), !container.__cpRenderedOnce);
        container.__cpRenderedOnce = true;
        return;
      }

      // 3. 收集各分类数据（展示分级：我的专属配装（如有）-> 友站分享 -> 国服顶尖 -> 玩家上传）
      var curIdStr = String(state.currentCarId);
      var remotePartnerList = state.remotePlans.filter(function (p) {
        return String(p.car_id) === curIdStr && Boolean(p.is_partner || p.isPartner);
      });
      var baseProList = state.proPlans.filter(function (p) {
        return String(p.car_id) === curIdStr;
      });
      var remoteProList = state.remotePlans.filter(function (p) {
        if (String(p.car_id) !== curIdStr) return false;
        if (p.is_partner || p.isPartner) return false;
        if (!p.is_pro && !p.isPro) return false;
        if (baseProList.some(function (bp) { return bp.id === p.id || bp.title === p.title; })) return false;
        return true;
      });
      var partnerList = remotePartnerList;
      var proList = baseProList.concat(remoteProList);
      var remoteList = state.remotePlans.filter(function (p) {
        if (String(p.car_id) !== curIdStr) return false;
        if (p.is_partner || p.isPartner) return false;
        if (p.is_pro || p.isPro) return false;
        if (proList.some(function (pr) { return pr.id === p.id; })) return false;
        return true;
      });
      var isShownInRemote = function (lp) {
        if (!lp || !lp.remote_id) return false;
        return state.remotePlans.some(function (rp) {
          return String(rp.car_id) === curIdStr && rp.id === lp.remote_id;
        });
      };
      var localList = state.savedPlans.filter(function (p) {
        return String(p.car_id) === curIdStr && (!p.remote_id || Boolean(state.ownedRemoteIds && state.ownedRemoteIds[p.remote_id]) || (p.remote_status === 'cleaned' && p.owner_identity_hash === state.currentIdentityHash)) && !isShownInRemote(p);
      });

      var loadedRemoteCount = partnerList.length + remoteProList.length + remoteList.length;
      var hasOfficialData = CommunityPlans._hasOfficialData();
      var officialPlanCount = hasOfficialData ? 1 : 0;
      var totalPlans = Math.max(loadedRemoteCount, state.remoteTotal || 0) + baseProList.length + localList.length + officialPlanCount;
      if (state.filterMode === 'all') {
        state.allCarTotal = Math.max(state.allCarTotal, totalPlans);
      }

      // 4. 更新标题栏徽标与折叠状态联动（无方案时也保持展开，仅遵从用户手动折叠状态）
      // 官方 AI 推荐也算一套方案：还在拉取、或已经有数据时，不能走进「暂无方案」早退
      var isCarTrulyEmpty = (
        totalPlans === 0 &&
        !hasOfficialData &&
        !state.isFetchingOfficial &&
        !state.isFetchingRemote &&
        state.filterMode === 'all' &&
        state.allCarTotal === 0
      );
      if (isCarTrulyEmpty) {
        var bannerSlotNone = document.getElementById('cpBannerSlot');
        if (bannerSlotNone) {
          bannerSlotNone.style.display = 'none';
          bannerSlotNone.innerHTML = '';
        }
        CommunityPlans._syncControlsBar(false, false);
        CommunityPlans._syncHeaderActions(false);
        if (badge) {
          badge.innerHTML = '<span class="zh">' + Utils.escapeHtml(carName) + ' · 暂无方案</span><span class="lang-en">' + Utils.escapeHtml(carName) + ' · No Setups</span>';
        }
        stream.innerHTML = [
          '<div class="cp-empty-box">',
          '  ' + Icons.emptyBox,
          '  <div class="cp-empty-title"><span class="zh">该赛车暂无任何芯片配装</span><span class="lang-en">No Setups Found</span></div>',
          '  <div class="cp-empty-desc"><span class="zh">在上方配好先机、汇能与芯片参数后，点击下方【立即保存当前配装】即可收藏您的专属方案！</span><span class="lang-en">Tune your chips above and click Save Setup Now to create one!</span></div>',
          '  <button type="button" class="nav-btn cp-btn cp-btn-save">' + Icons.save + '<span class="zh">立即保存当前配装</span><span class="lang-en">Save Setup Now</span></button>',
          '</div>'
        ].join('');
        var emptySaveBtn = stream.querySelector('.cp-empty-box .cp-btn-save');
        if (emptySaveBtn) emptySaveBtn.addEventListener('click', function () { CommunityPlans.openSaveModal(); });
        CommunityPlans.toggleCollapse(Boolean(state.userCollapsed), !container.__cpRenderedOnce);
        container.__cpRenderedOnce = true;
        return;
      }

      // 有方案、正在加载或正在筛选模式时更新标题徽标
      if (badge) {
        var knownTotal = Math.max(totalPlans, state.allCarTotal || 0);
        badge.innerHTML = (state.isFetchingRemote || state.isFetchingOfficial) && totalPlans === 0
          ? '<span class="zh">' + Utils.escapeHtml(carName) + ' · 加载中...</span><span class="lang-en">Loading...</span>'
          : '<span class="zh">' + Utils.escapeHtml(carName) + ' (' + knownTotal + ' 方案)</span><span class="lang-en">' + Utils.escapeHtml(carName) + '</span>';
      }

      // 5. 模式筛选与智能置底排序（当前模式可用的方案排前，不可用灰态方案沉底；桶内按最热/最新降序）
      var filterByPlanMode = function (list) {
        if (state.filterMode === 'all') return list;
        return list.filter(function (item) {
          return resolvePlanMode(item.params) === state.filterMode;
        });
      };
      var sortByCompatAndMetric = function (list) {
        return list.slice().sort(function (a, b) {
          var compatA = isPlanCompatibleWithMode(a.params, currentMode) ? 1 : 0;
          var compatB = isPlanCompatibleWithMode(b.params, currentMode) ? 1 : 0;
          if (compatA !== compatB) return compatB - compatA;
          if (state.sortMode === 'latest') {
            return (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
          }
          return (Number(b.votes) || 0) - (Number(a.votes) || 0);
        });
      };

      partnerList = sortByCompatAndMetric(filterByPlanMode(partnerList));
      proList = sortByCompatAndMetric(filterByPlanMode(proList));
      remoteList = sortByCompatAndMetric(filterByPlanMode(remoteList));
      localList = sortByCompatAndMetric(filterByPlanMode(localList));
      var filteredTotal = partnerList.length + proList.length + remoteList.length + localList.length;
      var catTotals = state.remoteCategoryTotals || {};
      var totalsMatchFilter = (state.remoteCategoryTotalsMode || 'all') === (state.filterMode || 'all');
      var sectionCount = function (loadedLen, key) {
        var serverN = Number(catTotals[key]);
        if (!totalsMatchFilter || !Number.isFinite(serverN)) return loadedLen;
        return Math.max(loadedLen, serverN);
      };
      var partnerCount = sectionCount(partnerList.length, 'partner');
      var proCount = sectionCount(proList.length, 'pro');
      var communityCount = sectionCount(remoteList.length, 'community');

      // 6. 更新顶部持久化横幅与常驻模式/排序控制条 + 内部固定高度可滚动列表视口
      var bannerHtml = '';
      var viewportHtml = [];
      var annNorm = CommunityPlans.normalizeAnnouncementMeta(state.siteMeta && state.siteMeta.announcement);
      var annCls = annNorm.level === 'warning' ? 'is-warn' : (annNorm.level === 'success' ? 'is-success' : '');
      if (state.siteMeta && state.siteMeta.maintenance_mode) {
        var maintText = state.siteMeta.maintenance_message || '社区服务正在维护中，您仍可正常使用本地保存方案';
        bannerHtml = '<div class="cp-site-banner is-warn">' + Icons.megaphone + '<span>' + Utils.escapeHtml(maintText) + '</span></div>';
      } else if (annNorm.enabled && annNorm.text && annNorm.display_mode !== 'popup_only') {
        var bannerTitle = annNorm.title ? ('【' + annNorm.title + '】') : '';
        var previewText = bannerTitle + annNorm.text.replace(/\s+/g, ' ');
        bannerHtml =
          '<button type="button" class="cp-site-banner is-clickable ' + annCls + '" title="点击展开完整公告详情">' +
            Icons.megaphone +
            '<span class="cp-site-banner-text">' + Utils.escapeHtml(previewText) + '</span>' +
            '<span class="cp-site-banner-more">查看详情</span>' +
          '</button>';
      }

      var bannerSlot = document.getElementById('cpBannerSlot');
      if (bannerSlot) {
        if (bannerSlot.__lastHtml !== bannerHtml) {
          bannerSlot.innerHTML = bannerHtml;
          bannerSlot.__lastHtml = bannerHtml;
          var bannerBtn = bannerSlot.querySelector('.cp-site-banner.is-clickable');
          if (bannerBtn) {
            bannerBtn.addEventListener('click', function () {
              CommunityPlans.openAnnouncementModal(null, { fromAuto: false });
            });
          }
        }
        bannerSlot.style.display = bannerHtml ? '' : 'none';
      }

      var cardMetas = [];
      if ((state.isFetchingRemote || state.isFetchingOfficial) && filteredTotal === 0 && !hasOfficialData) {
        viewportHtml.push([
          '<div class="cp-empty-box">',
          '  <div class="cp-empty-title">正在加载社区方案...</div>',
          '  <div class="cp-empty-desc">仅按需拉取当前车型第 1 页方案，请稍候</div>',
          '</div>'
        ].join(''));
      } else if (filteredTotal === 0 && !hasOfficialData) {
        var filterLabel = state.filterMode === 'solo' ? '先机汇能' : (state.filterMode === 'team' ? '团魂获能' : '全部');
        viewportHtml.push([
          '<div class="cp-empty-box cp-filter-empty">',
          '  ' + Icons.emptyBox,
          '  <div class="cp-empty-title">当前「' + filterLabel + '」模式下暂无方案</div>',
          '  <div class="cp-empty-desc">您可通过上方筛选栏切换其他模式，或点击下方按钮查看全部方案</div>',
          '  <button type="button" class="nav-btn cp-btn cp-btn-save">显示全部方案</button>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 1】：我的专属配装 (有本机自存/待审追踪时，排到展示列表最前)
      // ==========================================
      if (localList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-mine">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.user + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">我的专属配装</span><span class="lang-en">My Saved Setups</span></span>',
          '        <span class="cp-sec-count">' + localList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">保存在本机的专属调校方案与云端同步状态追踪</span><span class="lang-en">Your locally saved tuning setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          localList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'local', currentMode, cardMetas); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 2】：官方 AI 推荐 (游戏服务端 AI Lab 大数据芯片推荐，位于本地保存之下、友站分享之上)
      // ==========================================
      var officialHtml = CommunityPlans.renderOfficialSection(currentMode);
      if (officialHtml) {
        viewportHtml.push(officialHtml);
      }

      // ==========================================
      // 【分类 3】：友站分享 (合作友站实测推荐方案)
      // ==========================================
      if (partnerList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-partner">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.partner + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
        '        <span class="cp-sec-title"><span class="zh">友站分享</span><span class="lang-en">Partner Setups</span></span>',
        '        <span class="cp-sec-count">' + partnerCount + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">合作友站提供的实战芯片搭配参考，可点击作者主页前往查看原站与更多分享</span><span class="lang-en">Partner site curated setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          partnerList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'partner', currentMode, cardMetas); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 3】：国服顶尖 (官方推荐与自证认证)
      // ==========================================
      if (proList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-pro">',
          '  <div class="cp-sec-header">',
          '    <img src="data/icon/pro_helmet_m.png" class="cp-sec-pro-icon" alt="" loading="lazy">',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
        '        <span class="cp-sec-title"><span class="zh">国服顶尖</span><span class="lang-en">Pro Master Setups</span></span>',
        '        <span class="cp-sec-count">' + proCount + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">官方实战大数据与国服榜首车神认证配装</span><span class="lang-en">National top driver certified setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          proList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'pro', currentMode, cardMetas); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 4】：玩家上传 (车友社区推荐)
      // ==========================================
      if (remoteList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-community">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.hot + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
        '        <span class="cp-sec-title"><span class="zh">玩家上传</span><span class="lang-en">Community Setups</span></span>',
        '        <span class="cp-sec-count">' + communityCount + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">来自全网车友实战分享的方案，经安全初筛认证</span><span class="lang-en">Community contributed setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          remoteList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'community', currentMode, cardMetas); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // 底部懒加载哨兵与已加载进度条
      if (state.remotePlans.length > 0 || state.remoteHasMore) {
        var totalRemote = Math.max(state.remotePlans.length, state.remoteTotal || 0);
        var lazyText = state.remoteHasMore
          ? ('已加载 ' + state.remotePlans.length + ' / ' + totalRemote + ' 条社区方案 · 向下滚动自动加载')
          : ('已全部加载当前筛选下的 ' + totalRemote + ' 条社区方案');
        var lazyBtnHtml = state.remoteHasMore
          ? '<button type="button" class="cp-lazy-btn"' + (state.isLoadingMore ? ' disabled' : '') + '>' + (state.isLoadingMore ? '加载中...' : '加载更多') + '</button>'
          : '';
        viewportHtml.push(
          '<div id="cpLazySentinel" class="cp-lazy-footer">' +
            '<span class="cp-lazy-status">' + Utils.escapeHtml(lazyText) + '</span>' +
            lazyBtnHtml +
          '</div>'
        );
      }

      stream.innerHTML = '<div id="cpScrollViewport" class="cp-scroll-viewport">' + viewportHtml.join('') + '</div>';
      var showAllBtn = stream.querySelector('.cp-filter-empty .cp-btn-save');
      if (showAllBtn) showAllBtn.addEventListener('click', function () { CommunityPlans.setFilterMode('all'); });
      var officialApplyBtn = stream.querySelector('.cp-official-card .cp-apply-btn');
      if (officialApplyBtn) officialApplyBtn.addEventListener('click', function () { CommunityPlans.applyOfficialPlan('16-99'); });
      var lazyBtn = stream.querySelector('.cp-lazy-btn');
      if (lazyBtn) lazyBtn.addEventListener('click', function () { CommunityPlans.loadMoreRemotePlans(); });
      var cardEls = stream.querySelectorAll('article.cp-card-item:not(.cp-official-card)');
      for (var ci = 0; ci < cardEls.length && ci < cardMetas.length; ci++) {
        CommunityPlans._bindPlanCardEvents(cardEls[ci], cardMetas[ci]);
      }
      if (renderOpts.preserveScroll && savedScrollTop > 0) {
        var nextViewport = document.getElementById('cpScrollViewport');
        if (nextViewport) nextViewport.scrollTop = savedScrollTop;
      }
      CommunityPlans._playPendingVoteFx(stream);
      var isInitialCarLoading = (
        (state.isFetchingRemote || state.isFetchingOfficial) &&
        totalPlans === 0 &&
        !hasOfficialData &&
        state.filterMode === 'all' &&
        state.allCarTotal === 0
      );
      CommunityPlans.bindLazyScroll();
      CommunityPlans._syncHeaderActions(!isInitialCarLoading);
      CommunityPlans.toggleCollapse(Boolean(state.userCollapsed), !container.__cpRenderedOnce);
      CommunityPlans._syncControlsBar(!isInitialCarLoading, !isInitialCarLoading);
      CommunityPlans._layoutTreeLines();
      CommunityPlans._scheduleTreeLayout();
      CommunityPlans._bindTreeResizeObserver();
      container.__cpRenderedOnce = true;
    },

    _playPendingVoteFx: function (root) {
      var fx = state._pendingVoteFx;
      state._pendingVoteFx = null;
      if (!fx || !root || !cpMotionOK()) return;
      var btns = root.querySelectorAll('.cp-vote-btn[data-plan-id]');
      var matched = [];
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].getAttribute('data-plan-id') === String(fx.planId)) {
          matched.push(btns[i]);
        }
      }
      if (!matched.length) return;
      var sparkAngles = [-148, -98, -42, 16, 72, 132];
      var sparkColors = ['var(--acc)', '#ffd166', '#f59e0b', '#fbbf24', '#ffe599', 'var(--acc)'];
      var sparkSizes = ['4px', '3.5px', '4.5px', '3px', '4px', '3.5px'];
      matched.forEach(function (btn) {
        btn.classList.remove('is-bursting', 'is-unvoting');
        void btn.offsetWidth;
        btn.classList.add(fx.burst ? 'is-bursting' : 'is-unvoting');
        setTimeout(function () {
          btn.classList.remove('is-bursting', 'is-unvoting');
        }, 420);

        if (fx.burst) {
          var icoWrap = btn.querySelector('.cp-vote-ico-wrap');
          if (icoWrap) {
            var oldSparks = icoWrap.querySelectorAll('.cp-vote-spark');
            for (var s = 0; s < oldSparks.length; s++) oldSparks[s].remove();
            sparkAngles.forEach(function (deg, idx) {
              var rad = (deg + (Math.random() * 14 - 7)) * Math.PI / 180;
              var dist = 16 + (idx % 3) * 2.5 + Math.random() * 2;
              var sp = document.createElement('span');
              sp.className = 'cp-vote-spark';
              sp.setAttribute('aria-hidden', 'true');
              sp.style.setProperty('--tx', (Math.cos(rad) * dist).toFixed(1) + 'px');
              sp.style.setProperty('--ty', (Math.sin(rad) * dist).toFixed(1) + 'px');
              sp.style.setProperty('--sz', sparkSizes[idx]);
              sp.style.setProperty('--sp-color', sparkColors[idx]);
              sp.style.setProperty('--delay', (idx * 14) + 'ms');
              var removed = false;
              var cleanup = function () {
                if (removed) return;
                removed = true;
                if (sp.parentNode) sp.parentNode.removeChild(sp);
              };
              sp.addEventListener('animationend', cleanup, { once: true });
              setTimeout(cleanup, 580);
              icoWrap.appendChild(sp);
            });
          }
        }

        if (fx.from !== fx.to) {
          var countEl = btn.querySelector('.cp-vote-count');
          if (countEl) {
            var dir = fx.to > fx.from ? 'up' : 'down';
            countEl.innerHTML =
              '<span class="cp-vote-roll" data-dir="' + dir + '">' +
                '<span class="cp-vote-roll-old" aria-hidden="true">' + fx.from + '</span>' +
                '<span class="cp-vote-roll-new">' + fx.to + '</span>' +
              '</span>';
            setTimeout(function () {
              if (countEl.isConnected) {
                countEl.innerHTML = '<span class="cp-vote-num-cur">' + fx.to + '</span>';
              }
            }, 250);
          }
        }
      });
    },

    _bindPlanCardEvents: function (cardEl, meta) {
      if (!cardEl || !meta) return;
      var rejBadge = cardEl.querySelector('.cp-badge-rejected');
      if (rejBadge) rejBadge.addEventListener('click', function (ev) { CommunityPlans.showRejectModal(meta.planId, ev); });
      var rejBanner = cardEl.querySelector('.cp-card-reject-banner');
      if (rejBanner) rejBanner.addEventListener('click', function (ev) { CommunityPlans.showRejectModal(meta.planId, ev); });
      var pendBadge = cardEl.querySelector('.cp-badge-pending');
      if (pendBadge) pendBadge.addEventListener('click', function (ev) { CommunityPlans.checkPlanStatus(meta.planId, meta.remoteId, ev); });
      var partnerBadge = cardEl.querySelector('.cp-author-partner-badge');
      if (partnerBadge) partnerBadge.addEventListener('click', function (ev) { ev.stopPropagation(); });
      var playerBtn = cardEl.querySelector('.cp-player-id');
      if (playerBtn) playerBtn.addEventListener('click', function (ev) { CommunityPlans.copyPlayerId(meta.playerId, ev); });
      var voteBtn = cardEl.querySelector('.cp-vote-btn');
      if (voteBtn) voteBtn.addEventListener('click', function () { CommunityPlans.toggleVote(meta.planId); });
      var editBtn = cardEl.querySelector('.cp-edit-btn');
      if (editBtn) editBtn.addEventListener('click', function () { CommunityPlans.startEditPlan(meta.ownerLocalId); });
      var uploadBtn = cardEl.querySelector('.cp-upload-btn');
      if (uploadBtn) uploadBtn.addEventListener('click', function () { CommunityPlans.uploadLocalPlan(meta.ownerLocalId); });
      var delBtn = cardEl.querySelector('.cp-del-btn');
      if (delBtn) delBtn.addEventListener('click', function () { CommunityPlans.deletePlan(meta.ownerLocalId); });
      var applyBtn = cardEl.querySelector('.cp-apply-btn');
      if (applyBtn && !meta.isModeDisabled) {
        applyBtn.addEventListener('click', function () { CommunityPlans.applyPlanById(meta.planId); });
      }
    },

    // 渲染结构化三层方案卡片（全端统一清晰排版，杜绝内部嵌套小方框堆砌）
    renderPlanItem: function (item, type, calcMode, metaOut) {
      var p = item.params || {};
      var currentCalcMode = calcMode || ((typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo'));
      var details = extractAllPlanDetails(p, state.currentCar);
      var isModeDisabled = !isPlanCompatibleWithMode(p, currentCalcMode);
      var safePlanId = Utils.safeId(item.id);
      var safeRemoteId = item.remote_status === 'cleaned' ? '' : Utils.safeId(item.remote_id);
      var safePlayerId = Utils.safeId(item.player_id);
      var isVoted = Boolean(item.isVoted || state.votedMap[item.id] || (item.remote_id && state.votedMap[item.remote_id]));
      var isApplied = (state.activeAppliedPlanId === item.id);
      var isPartnerPlan = Boolean(item.isPartner || item.is_partner || type === 'partner');
      var isProPlan = !isPartnerPlan && Boolean(item.isPro || item.is_pro || type === 'pro');
      var isLocalPlan = (type === 'local');
      var isAuthorSelf = Boolean(item.viewer_is_author || (isLocalPlan && safeRemoteId && state.ownedRemoteIds && state.ownedRemoteIds[safeRemoteId]));
      // 已上传的方案会从「我的专属配装」移到社区分区，这里找回对应的本地记录，
      // 让作者本人即使在社区卡片上也能编辑/删除（用的是本地 id，走同一套接口）
      // 社区方案没有 remote_id 字段，它的 item.id 本身就是云端 id
      var myLocalCounterpart = !isLocalPlan
        ? state.savedPlans.filter(function (p) { return item.viewer_is_author && p && p.remote_id && p.remote_id === item.id; })[0]
        : null;
      var ownerLocalId = isLocalPlan ? safePlanId : (myLocalCounterpart ? Utils.safeId(myLocalCounterpart.id) : '');
      if (Array.isArray(metaOut)) {
        metaOut.push({
          planId: safePlanId,
          remoteId: safeRemoteId,
          playerId: safePlayerId,
          ownerLocalId: ownerLocalId,
          isModeDisabled: isModeDisabled
        });
      }

      // 渲染主页链接胶囊（带平台标识与外链图标，严禁中途断行）
      var linksHtml = '';
      if (Array.isArray(item.links) && item.links.length > 0) {
        var validLinks = [];
        item.links.forEach(function (l) {
          var safeUrl = Utils.sanitizeUrl(l);
          if (safeUrl) {
            var pf = Utils.detectPlatform(safeUrl);
            validLinks.push(
              '<a href="' + Utils.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" class="cp-author-link-btn ' + pf.cls + '" title="打开 ' + Utils.escapeHtml(pf.label) + '：' + Utils.escapeHtml(safeUrl) + '">' +
              (pf.icon || Icons.link) + '<span>' + Utils.escapeHtml(pf.label) + '</span></a>'
            );
          }
        });
        if (validLinks.length > 0) {
          linksHtml = '<div class="cp-author-links">' + validLinks.join('') + '</div>';
        }
      }

      var badgeText = isPartnerPlan
        ? '<span class="cp-card-badge cp-badge-partner">' + Icons.partner + ' 友站分享</span>'
        : (isProPlan
          ? '<span class="cp-card-badge cp-badge-pro">' + Icons.crown + ' 国服顶尖</span>'
          : (isLocalPlan ? '<span class="cp-card-badge cp-badge-local">本地方案</span>' : '<span class="cp-card-badge cp-badge-community">玩家上传</span>'));

      var modeBadge = details.isTeamPlan
        ? '<span class="cp-card-badge cp-badge-mode-team' + (isModeDisabled ? ' is-disabled' : '') + '">团魂模式</span>'
        : '';

      var auditStatusBadge = '';
      var rejectBannerHtml = '';
      if (isLocalPlan) {
        if (item.remote_status === 'rejected') {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-rejected" title="点击查看审核驳回说明">审核未通过</span>';
          var briefReason = String(item.reject_reason || item.review_notes || '未能通过审核，点击查看具体原因').trim();
          rejectBannerHtml =
            '<div class="cp-card-reject-banner" title="点击查看完整审核反馈说明">' +
            '  <span class="cp-reject-banner-lbl">审核未通过</span>' +
            '  <span class="cp-reject-banner-text">' + Utils.escapeHtml(briefReason) + '</span>' +
            '  <span class="cp-reject-banner-more">详情</span>' +
            '</div>';
        } else if (item.remote_status === 'cleaned') {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-cleaned" title="该方案已从云端移除或下架，本地备份仍可正常使用">云端已移除</span>';
        } else if (safeRemoteId) {
          if (item.remote_status === 'approved') {
            auditStatusBadge = '<span class="cp-card-badge cp-badge-approved">已收录</span>';
          } else {
            auditStatusBadge = '<span class="cp-card-badge cp-badge-pending" title="点击刷新审核状态">审核中</span>';
          }
        }
      }

      // 构建黄色高亮同行区（先机、汇能、团魂(模式2)、反制：手机端稳排同一行）
      var hlCellsHtml = details.hlCells.map(function (c) {
        return '<div class="cp-spec-hl-cell"><span class="cp-spec-lbl">' + Utils.escapeHtml(c.lbl) + '</span><span class="cp-spec-val is-acc" title="' + Utils.escapeHtml(c.val) + '">' + Utils.escapeHtml(c.val) + '</span></div>';
      }).join('');
      var hlRowHtml = details.hlCells.length > 0
        ? '<div class="cp-specs-hl-row" style="--hl-cols:' + details.hlCells.length + '">' + hlCellsHtml + '</div>'
        : '';

      // 构建其余矩阵单元格（氮气与发数、增益装置、干扰降效）
      var specCells = details.specCells.map(function (c) {
        var wideCls = String(c.val || '').length > 9 ? ' is-wide' : '';
        return '<div class="cp-spec-cell' + wideCls + '"><span class="cp-spec-lbl">' + Utils.escapeHtml(c.lbl) + '</span><span class="cp-spec-val ' + (c.cls || '') + '" title="' + Utils.escapeHtml(c.val) + '">' + Utils.escapeHtml(c.val) + '</span></div>';
      });
      var specGridHtml = specCells.length > 0
        ? '<div class="cp-specs-grid">' + specCells.join('') + '</div>'
        : '';

      var extraLines = details.extraRows.map(function (r) {
        return '<div class="cp-spec-extra-row"><span class="cp-spec-extra-k">' + Utils.escapeHtml(r.k) + '</span><span class="cp-spec-extra-v' + (r.acc ? ' is-acc' : '') + '">' + Utils.escapeHtml(r.v) + '</span></div>';
      });

      var specsExtraHtml = extraLines.length > 0
        ? '<div class="cp-specs-extra">' + extraLines.join('') + '</div>'
        : '';

      var noteText = item.notes ? String(item.notes).trim() : '';
      var noteHtml = noteText
        ? '<div class="cp-card-note-box"><span class="cp-note-label">备注</span><span class="cp-note-text">' + Utils.escapeHtml(noteText) + '</span></div>'
        : '';

      var voteBtnCls = 'nav-btn cp-vote-btn' + (isVoted ? ' is-voted' : '') + (isAuthorSelf ? ' is-author' : '');
      var voteBtnTitle = isAuthorSelf
        ? '不能给自己的方案点赞'
        : (isVoted ? '已点赞，再次点击取消赞' : '点赞支持该方案');

      var applyBtnLabelZh = isModeDisabled ? '需切换团魂模式' : (isApplied ? '已套用' : '一键套用');
      var applyBtnLabelEn = isModeDisabled ? 'Team Mode Only' : (isApplied ? 'Applied' : 'Apply');
      var applyBtnAttrs = isModeDisabled
        ? ' disabled aria-disabled="true" title="该方案含团魂或增益装置，请先切换至「团魂获能」模式"'
        : '';

      var partnerAuthorBadge = isPartnerPlan
        ? '<a class="cp-author-partner-badge" href="https://aceracer.top/" target="_blank" rel="noopener noreferrer" title="点击前往合作友站 https://aceracer.top/">' + Icons.partner + '<span>友站</span></a>'
        : '';

      return [
        '<article class="cp-card-item ' + (isPartnerPlan ? 'is-partner ' : '') + (isProPlan ? 'is-pro' : '') + ' ' + (isApplied ? 'is-applied' : '') + ' ' + (isModeDisabled ? 'is-mode-disabled' : '') + '">',
        '  <div class="cp-card-head">',
        '    <div class="cp-card-header-line">',
        '      <h4 class="cp-card-title">' + Utils.escapeHtml(item.title) + '</h4>',
        '      <div class="cp-card-badges">',
        badgeText,
        modeBadge,
        auditStatusBadge,
        (isApplied ? '<span class="cp-card-badge cp-badge-active">' + Icons.check + ' 生效中</span>' : ''),
        '      </div>',
        '    </div>',
        '    <div class="cp-card-meta">',
        '      <span class="cp-author-name">' + Utils.escapeHtml(item.author || '热心车友') + '</span>',
        partnerAuthorBadge,
        (safePlayerId ? '      <button type="button" class="cp-player-id" title="点击复制游戏ID"><span>ID ' + Utils.escapeHtml(safePlayerId) + '</span><span class="cp-copy-icon">' + Icons.copy + Icons.checkCopy + '</span></button>' : ''),
        linksHtml,
        '      <span class="cp-meta-time">' + Utils.formatTime(item.created_at) + '</span>',
        '    </div>',
        '  </div>',
        '  <div class="cp-specs-panel">',
        hlRowHtml,
        specGridHtml,
        specsExtraHtml,
        noteHtml,
        rejectBannerHtml,
        (isLocalPlan ? CommunityPlans.buildAnnotationHtml(item, safePlanId) : ''),
        '  </div>',
        '  <div class="cp-card-foot">',
        '    <div class="cp-foot-left">',
        ((!isLocalPlan || safeRemoteId)
          ? ('      <button type="button" class="' + voteBtnCls + '" data-plan-id="' + safePlanId + '" title="' + voteBtnTitle + '"' + (isAuthorSelf ? ' aria-disabled="true"' : '') + '>' +
             '<span class="cp-vote-ico-wrap">' + Icons.thumb(isVoted) + '</span>' +
             '<span class="cp-vote-count" data-count="' + (Number(item.votes) || 0) + '"><span class="cp-vote-num-cur">' + (Number(item.votes) || 0) + '</span></span></button>')
          : ''),
        (ownerLocalId && (isLocalPlan ? safeRemoteId : item.id)
          ? '      <button type="button" class="nav-btn cp-edit-btn" title="编辑这条已上传的方案（保存后重新送审）">' + Icons.edit + '</button>'
          : ''),
        (isLocalPlan && !safeRemoteId
          ? '      <button type="button" class="nav-btn cp-upload-btn" title="上传到云端（需人机验证）">' + Icons.upload + '</button>'
          : ''),
        (ownerLocalId
          ? '      <button type="button" class="nav-btn cp-del-btn" title="删除该方案">' + Icons.trash + '</button>'
          : ''),
        '    </div>',
        '    <button type="button" class="nav-btn cp-apply-btn ' + (isApplied && !isModeDisabled ? 'is-applied' : '') + (isModeDisabled ? ' is-disabled' : '') + '"' + applyBtnAttrs + '>',
        '      ' + (isModeDisabled ? '' : (isApplied ? Icons.check : Icons.apply)) + '<span class="zh">' + applyBtnLabelZh + '</span><span class="lang-en">' + applyBtnLabelEn + '</span>',
        '    </button>',
        '  </div>',
        '</article>'
      ].join('');
    },

    // 站长批注区（仅方案提交人可见）：复用 DS v4 玻璃卡片规范，样式见 community-plans.css
    buildAnnotationHtml: function (item, localId) {
      var list = Array.isArray(item.annotations) ? item.annotations : [];
      if (!list.length) return '';
      var esc = Utils.escapeHtml;
      var fmt = function (ts) {
        try {
          var d = new Date(ts);
          return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
        } catch (_) { return ''; }
      };
      var items = list.slice(-6).map(function (a) {
        var safeAnnoId = Utils.safeId(a.id);
        var safeLocalId = Utils.safeId(localId);
        var replies = (a.replies || []).map(function (r) {
          return '<div class="cp-anno-reply">'
            + '<div class="cp-anno-meta"><b>' + esc(r.author || '投稿人') + '</b><span>' + fmt(r.created_at) + '</span></div>'
            + '<div class="cp-anno-text">' + esc(r.content) + '</div>'
            + '</div>';
        }).join('');
        return '<div class="cp-anno-item">'
          + '<div class="cp-anno-meta"><b>' + esc(a.author || 'Vanem') + '</b><span>' + fmt(a.created_at) + '</span></div>'
          + '<div class="cp-anno-text">' + esc(a.content) + '</div>'
          + (replies ? '<div class="cp-anno-replies">' + replies + '</div>' : '')
          + '<div class="cp-anno-form">'
          + '<input class="cp-anno-input" type="text" maxlength="200" placeholder="回复这条批注…" data-anno-input="' + safeAnnoId + '">'
          + '<button type="button" class="cp-anno-send" data-anno-reply="' + safeAnnoId + '" data-local-id="' + safeLocalId + '">回复</button>'
          + '</div>'
          + '</div>';
      }).join('');
      return '<div class="cp-anno-wrap">'
        + '<div class="cp-anno-head">' + Icons.check + '<span>站长批注</span></div>'
        + items
        + '</div>';
    },

    replyAnnotation: function (localId, annoId) {
      // 防重入：连点按钮不会再发一遍
      if (state._replyingAnnoId) {
        CommunityPlans.toast('正在发送，请稍候…');
        return;
      }
      var plan = state.savedPlans.find(function (p) { return p.id === localId; });
      if (!plan || !plan.remote_id) return;
      var input = document.querySelector('[data-anno-input="' + Utils.safeId(annoId) + '"]');
      var content = input ? String(input.value || '').trim() : '';
      if (!content) {
        CommunityPlans.toast('回复内容不能为空');
        return;
      }

      state._replyingAnnoId = annoId;
      if (input) input.disabled = true;
      var sendBtn = input && input.parentNode ? input.parentNode.querySelector('.cp-anno-send') : null;
      if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '发送中'; }

      var reset = function () {
        state._replyingAnnoId = null;
        if (input) input.disabled = false;
        if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = '回复'; }
      };

      fetch('/api/plans', {
        method: 'POST',
        headers: Utils.getApiHeaders(true),
        body: JSON.stringify({ action: 'reply_annotation', plan_id: plan.remote_id, annotation_id: annoId, content: content })
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          var body = resObj.data || {};
          if (!resObj.ok || !body.success) {
            reset();
            CommunityPlans.toast('回复失败：' + (body.message || ('HTTP ' + resObj.status)));
            return;
          }
          // 直接用服务端返回的最新批注更新本地，立即重绘（重绘即清空输入框、刷新回复列表）
          var list = Array.isArray(plan.annotations) ? plan.annotations : [];
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === annoId) {
              list[i].replies = (body.annotation && body.annotation.replies) || list[i].replies || [];
              break;
            }
          }
          plan.annotations = list;
          if (input) input.value = '';
          Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
          state._replyingAnnoId = null;
          CommunityPlans.renderPlans({ preserveScroll: true });
          CommunityPlans.toast('回复已发送');
        })
        .catch(function (err) {
          reset();
          CommunityPlans.toast('回复失败：' + err.message);
        });
    },

    // 凭证图片暂存
    proofState: {
      rankingImg: null,
      profileImg: null
    },

    // Cloudflare Turnstile 人机校验框状态
    turnstileState: {
      widgetId: null,
      token: '',
      scriptPromise: null,
      isSubmitting: false
    },

    _setTurnstileStatus: function (text, mode) {
      var el = document.getElementById('cpTurnstileStatus');
      if (!el) return;
      el.textContent = text;
      el.className = 'cp-turnstile-status' + (mode ? ' is-' + mode : '');
    },

    ensureTurnstileScript: function () {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        return Promise.resolve(window.turnstile);
      }
      if (CommunityPlans.turnstileState.scriptPromise) {
        return CommunityPlans.turnstileState.scriptPromise;
      }
      CommunityPlans.turnstileState.scriptPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        var timer = setTimeout(function () {
          CommunityPlans.turnstileState.scriptPromise = null;
          reject(new Error('人机验证组件加载超时'));
        }, 8000);
        script.onload = function () {
          clearTimeout(timer);
          if (window.turnstile && typeof window.turnstile.render === 'function') {
            resolve(window.turnstile);
          } else {
            CommunityPlans.turnstileState.scriptPromise = null;
            reject(new Error('人机验证组件初始化异常'));
          }
        };
        script.onerror = function () {
          clearTimeout(timer);
          CommunityPlans.turnstileState.scriptPromise = null;
          reject(new Error('人机验证组件加载失败'));
        };
        document.head.appendChild(script);
      });
      return CommunityPlans.turnstileState.scriptPromise;
    },

    renderTurnstileWidget: function () {
      var wrap = document.getElementById('cpTurnstileWidget');
      if (!wrap) return;
      CommunityPlans.turnstileState.token = '';
      var box = document.getElementById('cpTurnstileBox');
      if (box) box.classList.remove('is-error');
      CommunityPlans._setTurnstileStatus('正在加载验证框...', '');
      wrap.innerHTML = '';

      CommunityPlans.ensureTurnstileScript()
        .then(function (ts) {
          var currentWrap = document.getElementById('cpTurnstileWidget');
          if (!currentWrap) return;
          if (CommunityPlans.turnstileState.widgetId !== null) {
            try { ts.remove(CommunityPlans.turnstileState.widgetId); } catch (_) {}
            CommunityPlans.turnstileState.widgetId = null;
          }
          var isLight = document.body.classList.contains('light-mode');
          var compact = (window.innerWidth || 600) < 360;
          CommunityPlans._setTurnstileStatus('请点击下方框完成校验', '');
          CommunityPlans.turnstileState.widgetId = ts.render('#cpTurnstileWidget', {
            sitekey: TURNSTILE_SITE_KEY,
            theme: isLight ? 'light' : 'dark',
            language: 'zh-CN',
            size: compact ? 'compact' : 'normal',
            callback: function (token) {
              CommunityPlans.turnstileState.token = token || '';
              var b = document.getElementById('cpTurnstileBox');
              if (b) b.classList.remove('is-error');
              CommunityPlans._setTurnstileStatus('✓ 验证已通过，可以提交', 'ok');
            },
            'expired-callback': function () {
              CommunityPlans.turnstileState.token = '';
              CommunityPlans._setTurnstileStatus('验证已过期，请重新勾选', 'err');
            },
            'error-callback': function () {
              CommunityPlans.turnstileState.token = '';
              CommunityPlans._setTurnstileStatus('验证加载出错，请重试', 'err');
            }
          });
        })
        .catch(function () {
          var currentWrap = document.getElementById('cpTurnstileWidget');
          if (!currentWrap) return;
          CommunityPlans._setTurnstileStatus('组件加载失败', 'err');
          currentWrap.innerHTML = '<span style="font-size:12px;color:var(--ink-3);">安全验证组件暂不可用<button type="button" class="cp-turnstile-retry">点击重试</button></span>';
          var retryBtn = currentWrap.querySelector('.cp-turnstile-retry');
          if (retryBtn) retryBtn.addEventListener('click', function () { CommunityPlans.renderTurnstileWidget(); });
        });
    },

    resetTurnstileWidget: function () {
      CommunityPlans.turnstileState.token = '';
      if (window.turnstile && CommunityPlans.turnstileState.widgetId !== null) {
        try {
          window.turnstile.reset(CommunityPlans.turnstileState.widgetId);
          CommunityPlans._setTurnstileStatus('请重新点击下方框完成校验', '');
          return;
        } catch (_) {}
      }
      CommunityPlans.renderTurnstileWidget();
    },

    onToggleSyncCommunity: function (isSync) {
      var sec = document.getElementById('cpCommunitySection');
      if (sec) sec.style.display = isSync ? 'flex' : 'none';
      var tsRequired = state.siteMeta ? state.siteMeta.turnstile_required !== false : true;
      if (isSync) {
        if (tsRequired) {
          CommunityPlans.renderTurnstileWidget();
        } else {
          var tsBox = document.getElementById('cpTurnstileBox');
          if (tsBox) tsBox.style.display = 'none';
        }
      } else {
        CommunityPlans.turnstileState.token = '';
        if (window.turnstile && CommunityPlans.turnstileState.widgetId !== null) {
          try { window.turnstile.remove(CommunityPlans.turnstileState.widgetId); } catch (_) {}
          CommunityPlans.turnstileState.widgetId = null;
        }
        var chkApplyPro = document.getElementById('cpChkApplyPro');
        if (chkApplyPro) {
          chkApplyPro.checked = false;
          CommunityPlans.onToggleApplyPro(false);
        }
      }
    },

    onToggleApplyPro: function (isApply) {
      var sec = document.getElementById('cpProProofSection');
      if (sec) sec.style.display = isApply ? 'flex' : 'none';
    },

    triggerProofUpload: function (type) {
      var input = document.getElementById('cpFile_' + type);
      if (input) {
        input.value = '';
        input.click();
      }
    },

    handleProofFile: function (type, input) {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      if (!file.type.match(/^image\//)) {
        CommunityPlans.toast('请上传有效的图片文件 (JPG/PNG/WEBP)');
        input.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        CommunityPlans.toast('单张截图大小不能超过 2 MB，请压缩或裁剪后重新上传');
        input.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUrl = e.target.result;
        var img = new Image();
        img.onload = function () {
          var maxW = 1280, maxH = 1280;
          var w = img.width, h = img.height;
          if (w > maxW || h > maxH) {
            if (w / h > maxW / maxH) {
              h = Math.round(h * (maxW / w));
              w = maxW;
            } else {
              w = Math.round(w * (maxH / h));
              h = maxH;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var compressed = canvas.toDataURL('image/jpeg', 0.82);
          var getDecodedBytes = function (dUrl) {
            var idx = dUrl.indexOf(',');
            var b64 = idx >= 0 ? dUrl.slice(idx + 1) : dUrl;
            return Math.floor(b64.length * 0.75);
          };
          if (getDecodedBytes(compressed) > 1500000) {
            compressed = canvas.toDataURL('image/jpeg', 0.65);
          }
          if (getDecodedBytes(compressed) > 2 * 1024 * 1024) {
            CommunityPlans.toast('图片压缩后仍超过 2 MB，请换一张分辨率更低的截图');
            input.value = '';
            return;
          }
          var proofKey = type === 'profile' ? 'profileImg' : 'rankingImg';
          CommunityPlans.proofState[proofKey] = compressed;

          var card = document.getElementById('cpProofCard_' + type);
          if (card) {
            card.style.borderColor = '';
            card.classList.add('has-file');
            card.innerHTML = [
              '<div class="cp-proof-thumb-box">',
              '  <img src="' + compressed + '" class="cp-proof-thumb" alt="预览">',
              '  <button type="button" class="cp-proof-btn-reupload">重新选择</button>',
              '</div>'
            ].join('');
            var reuploadBtn = card.querySelector('.cp-proof-btn-reupload');
            if (reuploadBtn) {
              reuploadBtn.addEventListener('click', function (ev) {
                ev.stopPropagation();
                CommunityPlans.triggerProofUpload(type);
              });
            }
          }
        };
        img.onerror = function () {
          CommunityPlans.toast('图片解码失败，请确认文件未损坏或更换格式 (JPG/PNG)');
          input.value = '';
        };
        img.src = dataUrl;
      };
      reader.onerror = function () {
        CommunityPlans.toast('读取截图文件失败，请重新选择');
        input.value = '';
      };
      reader.readAsDataURL(file);
    },

    // 关闭保存方案弹窗并彻底销毁凭证内存、Turnstile 实例与解锁背景滚动（杜绝图床滥用与滚动穿透）
    closeSaveModal: function () {
      // 只有用户主动关掉弹窗（而非 openSaveModal 内部清理）才把编辑条还回去
      if (state.editingPlan && !state._suppressBarRestore) {
        setTimeout(function () {
          if (state.editingPlan) CommunityPlans.showEditingBar(state.editingPlan.title);
        }, 60);
      }
      if (state._saveSuccessTimer) {
        clearTimeout(state._saveSuccessTimer);
        state._saveSuccessTimer = null;
      }
      if (window.turnstile && CommunityPlans.turnstileState.widgetId !== null) {
        try { window.turnstile.remove(CommunityPlans.turnstileState.widgetId); } catch (_) {}
      }
      CommunityPlans.turnstileState.widgetId = null;
      CommunityPlans.turnstileState.token = '';
      CommunityPlans.turnstileState.isSubmitting = false;

      var modal = document.getElementById('cpSaveModal');
      if (modal) modal.remove();
      document.body.classList.remove('cp-modal-locked');
      CommunityPlans.proofState.rankingImg = null;
      CommunityPlans.proofState.profileImg = null;
      if (CommunityPlans._escKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._escKeyHandler);
        CommunityPlans._escKeyHandler = null;
      }
    },

    // 打开保存方案弹窗 (Modal)
    openSaveModal: function () {
      if (!state.currentCarId) {
        CommunityPlans.toast('请先在上方选择一辆赛车');
        return;
      }
      // 弹窗盖上来时先把顶部编辑条收起，避免两层浮层叠着
      if (state.editingPlan) CommunityPlans.hideEditingBar();
      state._suppressBarRestore = true;
      CommunityPlans.closeSaveModal();
      state._suppressBarRestore = false;

      var carName = state.currentCar ? state.currentCar.name : '当前赛车';
      var params = ParamsIO.capture();
      var modeLabel = params.calc_mode === 'team' ? '团魂获能模式' : '先机汇能模式';
      var summary = '[' + modeLabel + '] ' + extractAllPlanDetails(params, state.currentCar).summaryText;

      var modal = document.createElement('div');
      modal.id = 'cpSaveModal';
      modal.className = 'cp-modal-overlay is-open';
      modal.onclick = function (e) {
        if (e.target === modal) CommunityPlans.closeSaveModal();
      };
      // 阻止遮罩空白处滚轮穿透到背后页面本体
      modal.addEventListener('wheel', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });
      modal.addEventListener('touchmove', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });

      // 锁定背景网页滚动
      document.body.classList.add('cp-modal-locked');

      // 绑定 ESC 关闭快捷键
      CommunityPlans._escKeyHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          CommunityPlans.closeSaveModal();
        }
      };
      document.addEventListener('keydown', CommunityPlans._escKeyHandler);
      var allowSubmissions = !state.siteMeta || (state.siteMeta.allow_submissions !== false && !state.siteMeta.maintenance_mode);
      var allowPro = !state.siteMeta || state.siteMeta.allow_pro_applications !== false;
      var tsRequired = !state.siteMeta || state.siteMeta.turnstile_required !== false;

      modal.innerHTML = [
        '<div class="card cp-modal-dialog">',
        '  <div class="cp-modal-head">',
        '    <h4 class="cp-modal-title">保存芯片配装 (' + Utils.escapeHtml(carName) + ')</h4>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close">',
        '      ' + Icons.close,
        '    </button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        '    <div class="cp-summary-bar">',
        '      <span class="zh">配装参数摘要: </span><span class="cp-summary-val">' + Utils.escapeHtml(summary) + '</span>',
        '    </div>',
        '    <div class="form-group cp-form-group">',
        '      <div class="cp-label-row">',
        '        <label class="form-label" for="cpInputTitle">方案名称 <span style="color:var(--fail,#e53935);">*</span> (必填，15字以内)</label>',
        '        <span id="cpTitleCounter" class="cp-input-count">0/15</span>',
        '      </div>',
        '      <div class="input-wrapper">',
        '        <input type="text" id="cpInputTitle" class="form-control cp-modal-input" placeholder="例如：大招连发稳健装" maxlength="15" autocomplete="off">',
        '      </div>',
        '    </div>',
        '    <div class="form-group cp-form-group">',
        '      <div class="cp-label-row">',
        '        <label class="form-label" for="cpInputNotes">方案备注 (选填，可写跑图思路、细节提醒)</label>',
        '        <span id="cpNotesCounter" class="cp-input-count">0/300</span>',
        '      </div>',
        '      <div class="input-wrapper">',
        '        <textarea id="cpInputNotes" class="form-control cp-modal-input cp-modal-textarea" rows="3" placeholder="例如：弯道提前踩减速带触发、双氮气起手注意节气（留空不显示）" maxlength="300"></textarea>',
        '      </div>',
        '    </div>',
        '    <!-- 开关 1: 是否上传方案至全网社区库 (规范 Switch，默认关闭) -->',
        '    <div class="cp-setting-switch-row' + (allowSubmissions ? '' : ' is-disabled') + '">',
        '      <div class="cp-setting-switch-info">',
        '        <span class="cp-setting-switch-title">上传芯片方案至全网社区库</span>',
        '        <span class="cp-setting-switch-desc">' + (allowSubmissions ? '默认关闭（仅保存在本机浏览器中）；开启后经安全初筛共享至全网方案库' : '全站社区投稿当前已暂停，您仍可将方案保存在本地浏览器中') + '</span>',
        '      </div>',
        '      <input type="checkbox" id="cpChkSyncCommunity" class="ui-switch"' + (allowSubmissions ? '' : ' disabled') + '>',
        '    </div>',
        '    <!-- 社区上传扩展设置区 (开启上方开关后动态展开) -->',
        '    <div class="cp-community-section" id="cpCommunitySection" style="display: none;">',
        '      <div class="form-group cp-form-group">',
        '        <div class="cp-label-row">',
        '          <span class="form-label">作者署名使用个人信息中的昵称</span>',
        '          <div class="cp-switch-label-wrap">',
        '            <input type="checkbox" id="cpChkAnon" class="ui-switch">',
        '            <span class="cp-switch-label-text">匿名上传</span>',
        '          </div>',
        '        </div>',
        '      </div>',
        '      <div class="form-group cp-form-group" id="cpLinksGroup">',
        '        <label class="form-label">个人主页链接 (选填，最多 3 个，仅限 B站 / 抖音 / 快手，支持粘贴分享文案自动提取)</label>',
        '        <div class="cp-links-input-list">',
        '          <div class="cp-link-input-wrap" id="cpLinkWrap1"><div class="cp-link-input-row"><span class="cp-link-idx">1</span><input type="text" id="cpInputLink1" class="form-control cp-modal-input" placeholder="粘贴 B站主页链接或分享口令 (space.bilibili.com / b23.tv)" autocomplete="off"></div><div class="cp-link-parse-msg" id="cpLinkMsg1"></div></div>',
        '          <div class="cp-link-input-wrap" id="cpLinkWrap2"><div class="cp-link-input-row"><span class="cp-link-idx">2</span><input type="text" id="cpInputLink2" class="form-control cp-modal-input" placeholder="粘贴 抖音主页链接或分享文案 (自动去除中文与乱码)" autocomplete="off"></div><div class="cp-link-parse-msg" id="cpLinkMsg2"></div></div>',
        '          <div class="cp-link-input-wrap" id="cpLinkWrap3"><div class="cp-link-input-row"><span class="cp-link-idx">3</span><input type="text" id="cpInputLink3" class="form-control cp-modal-input" placeholder="粘贴 快手主页链接或分享文案 (支持长/短链接)" autocomplete="off"></div><div class="cp-link-parse-msg" id="cpLinkMsg3"></div></div>',
        '        </div>',
        '      </div>',
        '      <!-- 开关 2: 申请入选国服顶尖方案池 (规范 Switch，默认关闭) -->',
        '      <div class="cp-setting-switch-row cp-pro-apply-row" style="' + (allowPro ? '' : 'display:none;') + '">',
        '        <div class="cp-setting-switch-info">',
        '          <div class="cp-pro-apply-badge-line">',
        '            <img src="data/icon/pro_helmet_m.png" class="cp-sec-pro-icon" alt="" style="width:20px;height:20px;">',
        '            <span class="cp-setting-switch-title">申请入选「国服顶尖方案池」</span>',
        '          </div>',
        '          <span class="cp-setting-switch-desc">开放车友自证通道；需审核双截图凭证，审核通过后置入国服推荐列表</span>',
        '        </div>',
        '        <input type="checkbox" id="cpChkApplyPro" class="ui-switch">',
        '      </div>',
        '      <!-- 国服最强自证双截图凭证上传区 (开启国服顶尖申请后展开) -->',
        '      <div class="cp-pro-apply-box" id="cpProProofSection" style="display: none;">',
        '        <div class="cp-proof-alert-card">',
        '          <div class="cp-proof-alert-title">',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        '            <span>国服顶尖认证硬性审核准则</span>',
        '          </div>',
        '          <ul class="cp-proof-alert-list">',
        '            <li>必须提交与当前配置车辆 (<strong>' + Utils.escapeHtml(carName) + '</strong>) <strong>完全一致</strong>的国服最强荣誉称号/榜单截图。</li>',
        '            <li>必须带有官方<strong>钻石色大国标</strong>（全国前十车神认证）。</li>',
        '            <li>个人主页截图必须包含您的游戏昵称与数字 ID，以核验方案归属权。</li>',
        '            <li>单张截图大小不能超过 <strong>2 MB</strong>（支持 JPG / PNG / WEBP）。</li>',
        '          </ul>',
        '        </div>',
        '        <div class="cp-proof-grid">',
        '          <!-- 截图入口 1: 本车国服最强荣誉截图 -->',
        '          <div class="cp-proof-card" id="cpProofCard_ranking">',
        '            <span class="cp-proof-card-badge">必传凭证 1</span>',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;color:var(--acc);margin-bottom:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        '            <span style="font-weight:700;font-size:12.5px;color:var(--ink);">本车国服最强荣誉截图</span>',
        '            <span class="cp-proof-card-desc">需含钻石大国标（全国前十）· 单张≤2MB</span>',
        '          </div>',
        '          <!-- 截图入口 2: 个人主页截图 -->',
        '          <div class="cp-proof-card" id="cpProofCard_profile">',
        '            <span class="cp-proof-card-badge">必传凭证 2</span>',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;color:var(--acc);margin-bottom:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        '            <span style="font-weight:700;font-size:12.5px;color:var(--ink);">游戏个人主页截图</span>',
        '            <span class="cp-proof-card-desc">需含游戏昵称与数字ID · 单张≤2MB</span>',
        '          </div>',
        '        </div>',
        '        <input type="file" id="cpFile_ranking" class="cp-proof-file-input" accept="image/*">',
        '        <input type="file" id="cpFile_profile" class="cp-proof-file-input" accept="image/*">',
        '      </div>',
        '      <!-- 提交前安全验证 (Cloudflare Turnstile，点亮对勾后方可提交) -->',
        '      <div class="cp-turnstile-box" id="cpTurnstileBox" style="' + (tsRequired ? '' : 'display:none;') + '">',
        '        <div class="cp-turnstile-head">',
        '          <span class="cp-turnstile-title">提交前安全验证</span>',
        '          <span class="cp-turnstile-status" id="cpTurnstileStatus">等待加载验证框...</span>',
        '        </div>',
        '        <div class="cp-turnstile-widget-wrap" id="cpTurnstileWidget"></div>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="cp-modal-footer">',
        '    <button type="button" class="nav-btn cp-btn cp-btn-cancel">取消</button>',
        '    <button type="button" id="cpBtnConfirmSave" class="nav-btn cp-btn cp-btn-save">' + Icons.save + ' 确认保存</button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);

      var dlg = modal.querySelector('.cp-modal-dialog');
      if (dlg) dlg.addEventListener('click', function (e) { e.stopPropagation(); });
      var closeBtn = modal.querySelector('.cp-modal-close');
      if (closeBtn) closeBtn.addEventListener('click', function () { CommunityPlans.closeSaveModal(); });
      var cancelBtn = modal.querySelector('.cp-btn-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { CommunityPlans.closeSaveModal(); });
      var confirmBtn = modal.querySelector('#cpBtnConfirmSave');
      if (confirmBtn) confirmBtn.addEventListener('click', function () { CommunityPlans.confirmSave(); });

      var titleInput = modal.querySelector('#cpInputTitle');
      if (titleInput) titleInput.addEventListener('input', function () { CommunityPlans.onTitleInput(this); });
      var notesInput = modal.querySelector('#cpInputNotes');
      if (notesInput) notesInput.addEventListener('input', function () { CommunityPlans.onNotesInput(this); });
      var syncChk = modal.querySelector('#cpChkSyncCommunity');
      if (syncChk) syncChk.addEventListener('change', function () { CommunityPlans.onToggleSyncCommunity(this.checked); });
      var anonChk = modal.querySelector('#cpChkAnon');
      if (anonChk) anonChk.addEventListener('change', function () { CommunityPlans.onToggleAnon(this.checked); });
      var proChk = modal.querySelector('#cpChkApplyPro');
      if (proChk) proChk.addEventListener('change', function () { CommunityPlans.onToggleApplyPro(this.checked); });

      [1, 2, 3].forEach(function (idx) {
        var linkEl = modal.querySelector('#cpInputLink' + idx);
        if (!linkEl) return;
        linkEl.addEventListener('input', function () { CommunityPlans.onLinkInput(this, idx); });
        linkEl.addEventListener('paste', function () {
          setTimeout(function () { CommunityPlans.onLinkInput(linkEl, idx, true); }, 0);
        });
        linkEl.addEventListener('blur', function () { CommunityPlans.onLinkInput(this, idx, true); });
      });

      ['ranking', 'profile'].forEach(function (pType) {
        var cardEl = modal.querySelector('#cpProofCard_' + pType);
        if (cardEl) cardEl.addEventListener('click', function () { CommunityPlans.triggerProofUpload(pType); });
        var fileEl = modal.querySelector('#cpFile_' + pType);
        if (fileEl) fileEl.addEventListener('change', function () { CommunityPlans.handleProofFile(pType, this); });
      });

      // 编辑已上传方案：预填标题/备注，并把保存按钮改成「保存修改并重新送审」
      if (state.editingPlan) {
        var tEl = document.getElementById('cpInputTitle');
        var nEl = document.getElementById('cpInputNotes');
        if (tEl && state.editingPlan.title) {
          tEl.value = state.editingPlan.title;
          CommunityPlans.onTitleInput(tEl);
        }
        if (nEl && state.editingPlan.notes) {
          nEl.value = state.editingPlan.notes;
          CommunityPlans.onNotesInput(nEl);
        }
        var saveBtnEl = document.getElementById('cpBtnConfirmSave');
        if (saveBtnEl) saveBtnEl.innerHTML = Icons.save + ' 保存修改并重新送审';
      }

      // 编辑 / 补传时必须是云端操作：勾上同步并锁死，否则会退化成「存本地新建一条」
      if (state.editingPlan || state.uploadingLocalId) {
        var syncChk = document.getElementById('cpChkSyncCommunity');
        if (syncChk) {
          syncChk.checked = true;
          syncChk.disabled = true;
          if (typeof CommunityPlans.onToggleSyncCommunity === 'function') {
            CommunityPlans.onToggleSyncCommunity(true);
          }
        }
      }

      setTimeout(function () {
        var input = document.getElementById('cpInputTitle');
        if (input) input.focus();
      }, 50);
    },

    onTitleInput: function (el) {
      var countEl = document.getElementById('cpTitleCounter');
      if (!countEl) return;
      var len = Utils.charCount(el.value);
      if (len > 15) {
        el.value = Utils.truncateChars(el.value, 15);
        len = 15;
      }
      countEl.textContent = len + '/15';
      if (len >= 15) countEl.classList.add('is-limit');
      else countEl.classList.remove('is-limit');
    },

    onNotesInput: function (el) {
      var countEl = document.getElementById('cpNotesCounter');
      if (!countEl) return;
      var len = Utils.charCount(el.value);
      if (len > 300) {
        el.value = Utils.truncateChars(el.value, 300);
        len = 300;
      }
      countEl.textContent = len + '/300';
      if (len >= 300) countEl.classList.add('is-limit');
      else countEl.classList.remove('is-limit');
    },

    onToggleAnon: function (isAnon) {
      var authorInput = document.getElementById('cpInputAuthor');
      var linksGroup = document.getElementById('cpLinksGroup');
      if (authorInput) {
        if (isAnon) {
          authorInput.value = '';
          authorInput.disabled = true;
          authorInput.placeholder = '已开启匿名 (将展示为热心车友)';
        } else {
          authorInput.disabled = false;
          authorInput.placeholder = '您的昵称 (选填)';
        }
      }
      if (linksGroup) {
        linksGroup.style.display = isAnon ? 'none' : 'block';
      }
    },

    onLinkInput: function (el, idx, notifyOnExtract) {
      if (!el) return { ok: true, url: '' };
      var wrap = document.getElementById('cpLinkWrap' + idx);
      var msgEl = document.getElementById('cpLinkMsg' + idx);
      var raw = String(el.value || '');
      if (!raw.trim()) {
        if (wrap) wrap.classList.remove('is-valid', 'is-error');
        if (msgEl) msgEl.textContent = '';
        return { ok: true, url: '' };
      }

      var parsed = Utils.extractProfileLink(raw);
      if (parsed.ok && !parsed.empty && parsed.url) {
        if (parsed.changed) {
          el.value = parsed.url;
        }
        if (wrap) {
          wrap.classList.remove('is-error');
          wrap.classList.add('is-valid');
        }
        if (msgEl) {
          msgEl.textContent = parsed.changed
            ? '✓ 已自动提取纯净「' + parsed.label + '」（已去除多余文字与追踪尾巴）'
            : '✓ 已识别「' + parsed.label + '」';
        }
        if (notifyOnExtract && parsed.changed) {
          CommunityPlans.toast('已自动提取纯净' + parsed.label);
        }
        return { ok: true, url: parsed.url };
      }

      // 用户仍在手动输入前缀尚未输完时，只在失焦/粘贴/提交或明显完整 URL 不合白名单时标红提示
      var looksComplete = notifyOnExtract || /https?:\/\/[^\s]{6,}\.[a-z]{2,}/i.test(raw);
      if (looksComplete) {
        if (wrap) {
          wrap.classList.remove('is-valid');
          wrap.classList.add('is-error');
        }
        if (msgEl) {
          msgEl.textContent = '仅支持 B站 / 抖音 / 快手 个人主页或官方短链接，已屏蔽其他网址';
        }
        return { ok: false, url: '' };
      } else {
        if (wrap) wrap.classList.remove('is-valid', 'is-error');
        if (msgEl) msgEl.textContent = '';
        return { ok: false, url: '', typing: true };
      }
    },

    confirmSave: function () {
      var titleInput = document.getElementById('cpInputTitle');
      var notesInput = document.getElementById('cpInputNotes');
      var authorInput = document.getElementById('cpInputAuthor');
      var chkAnon = document.getElementById('cpChkAnon');
      if (!titleInput) return;

      var title = titleInput.value.trim();
      var notes = notesInput ? Utils.truncateChars(notesInput.value.trim(), 300) : '';
      var params = ParamsIO.capture();

      var check = PlanValidator.validate(params, title);
      if (!check.valid) {
        CommunityPlans.toast(check.message);
        titleInput.focus();
        return;
      }

      var currentSig = Utils.computeLocalBuildSig(state.currentCarId, params);

      // 堵死套用他人方案后直接保存或改名提交：与刚套用且属于他人的方案完全一致时拦截
      if (
        state.appliedSource &&
        state.appliedSource.isOther &&
        (state.appliedSource.appliedDomSig === currentSig || state.appliedSource.sourceBuildSig === currentSig)
      ) {
        CommunityPlans.toast('当前配装直接来自「' + state.appliedSource.title + '」且未作任何参数改动，请先自行调整参数后再保存或提交');
        return;
      }

      // 与在线国服/社区池里他人已过审方案配装签名完全一致时同样拦截
      var dupRemote = state.remotePlans.find(function (rp) {
        if (String(rp.car_id) !== String(state.currentCarId)) return false;
        if (rp.viewer_is_author) return false;
        var matchedOwn = Boolean(state.ownedRemoteIds && state.ownedRemoteIds[rp.id]);
        if (matchedOwn) return false;
        return Utils.computeLocalBuildSig(rp.car_id, rp.params) === currentSig;
      });
      if (dupRemote) {
        CommunityPlans.toast('当前配装参数与社区已有方案「' + dupRemote.title + '」完全一致，请先自行调整参数后再保存或提交');
        return;
      }

      var isAnon = chkAnon ? chkAnon.checked : false;
      var author = isAnon ? '热心车友' : (authorInput ? authorInput.value.trim() : '');

      var links = [];
      if (!isAnon) {
        for (var li = 1; li <= 3; li++) {
          var lEl = document.getElementById('cpInputLink' + li);
          if (lEl && lEl.value && lEl.value.trim()) {
            var lRes = CommunityPlans.onLinkInput(lEl, li, true);
            if (!lRes.ok || !lRes.url) {
              CommunityPlans.toast('第 ' + li + ' 个主页链接无效：仅支持 B站 / 抖音 / 快手 官方个人主页或短链接');
              lEl.focus();
              return;
            }
            if (links.indexOf(lRes.url) === -1 && links.length < 3) {
              links.push(lRes.url);
            }
          }
        }
      }

      var chkSync = document.getElementById('cpChkSyncCommunity');
      var isSync = chkSync ? chkSync.checked : false;
      if (isSync) {
        if (!state.identityApiReady) {
          CommunityPlans.toast('社区身份服务正在更新或尚未连接，请稍后再提交');
          CommunityPlans.syncOwnedPlans(true);
          return;
        }
        var profileNickname = window.ArcProfile && window.ArcProfile.getNickname();
        if (!profileNickname) {
          CommunityPlans.toast('请先在个人信息中填写昵称，再提交方案');
          if (window.ArcProfile) window.ArcProfile.open();
          return;
        }
        author = isAnon ? '热心车友' : profileNickname;
      }

      var chkApplyPro = document.getElementById('cpChkApplyPro');
      var isApplyPro = isSync && chkApplyPro ? chkApplyPro.checked : false;

      if (isSync && state.siteMeta && state.siteMeta.maintenance_mode) {
        CommunityPlans.toast(state.siteMeta.maintenance_message || '当前维护中暂不接收社区投稿');
        return;
      }

      // 申请国服顶尖方案池时的双截图强制阻断校验
      if (isApplyPro) {
        if (!CommunityPlans.proofState.rankingImg || !CommunityPlans.proofState.profileImg) {
          CommunityPlans.toast('申请国服顶尖必须提交两张审核凭证截图（国服最强钻石大国标截图 + 个人主页截图）');
          var rankingCard = document.getElementById('cpProofCard_ranking');
          var profileCard = document.getElementById('cpProofCard_profile');
          if (!CommunityPlans.proofState.rankingImg && rankingCard) {
            rankingCard.style.borderColor = 'var(--fail, #ff4757)';
          }
          if (!CommunityPlans.proofState.profileImg && profileCard) {
            profileCard.style.borderColor = 'var(--fail, #ff4757)';
          }
          return;
        }
      }

      var tsRequired = !state.siteMeta || state.siteMeta.turnstile_required !== false;
      // 同步至社区方案库时，若启用了 Turnstile 则提交前必须先点击完成校验
      if (isSync) {
        if (CommunityPlans.turnstileState.isSubmitting) return;
        if (tsRequired && !CommunityPlans.turnstileState.token) {
          CommunityPlans.toast('请先点击完成人机验证框（勾选通过后再提交）');
          var tsBox = document.getElementById('cpTurnstileBox');
          if (tsBox) {
            tsBox.classList.add('is-error');
            try { tsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
          }
          CommunityPlans._setTurnstileStatus('提交前请先点击完成验证', 'err');
          return;
        }
      }

      var planItem = {
        id: Utils.uuid(),
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : '',
        title: Utils.truncateChars(title, 15),
        notes: notes,
        author: author || '热心车友',
        links: links,
        params: params,
        build_sig: currentSig,
        votes: 0,
        isVoted: false,
        viewer_is_author: true,
        created_at: Utils.now()
      };

      // 不勾选上传社区时，零验证直接保存在本机浏览器
      if (!isSync) {
        if (editing) {
          // 编辑态兜底：只更新本地那条，绝不新增
          var fallback = state.savedPlans.find(function (x) { return x.id === editing.localId; });
          if (fallback) {
            fallback.title = planItem.title;
            fallback.notes = planItem.notes;
            fallback.params = planItem.params;
            fallback.build_sig = planItem.build_sig;
          }
          state.editingPlan = null;
          CommunityPlans.hideEditingBar();
          Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
          CommunityPlans.closeSaveModal();
          CommunityPlans.renderPlans();
          CommunityPlans.toast('已更新本地方案「' + title + '」');
          return;
        }
        state.savedPlans.unshift(planItem);
        Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
        CommunityPlans.closeSaveModal();
        CommunityPlans.renderPlans();
        CommunityPlans.toast('方案「' + title + '」已成功保存到本机');
        return;
      }

      // 提取凭证快照（仅供同步请求一次性使用）
      var proProofData = isApplyPro ? {
        ranking_img: CommunityPlans.proofState.rankingImg,
        profile_img: CommunityPlans.proofState.profileImg,
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : ''
      } : null;

      if (isApplyPro) {
        var rankBytes = Utils.getDataUrlDecodedBytes(CommunityPlans.proofState.rankingImg);
        var profBytes = Utils.getDataUrlDecodedBytes(CommunityPlans.proofState.profileImg);
        if (rankBytes > 2 * 1024 * 1024 || profBytes > 2 * 1024 * 1024 || (rankBytes + profBytes) > 3.1 * 1024 * 1024) {
          CommunityPlans.toast('两张审核截图总体积过大（单张≤2MB，合计建议≤3MB），请换用压缩后的截图再试');
          return;
        }
      }

      var saveBtn = document.getElementById('cpBtnConfirmSave');
      CommunityPlans.turnstileState.isSubmitting = true;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.classList.remove('is-success');
        saveBtn.classList.add('is-loading');
        saveBtn.innerHTML = Icons.spinner + '<span>提交验证中...</span>';
      }

      var fullParams = Object.assign({}, params, {
        start_nitro_count: params.first_nitro_count,
        cycle_nitro_count: params.loop_nitro_count,
        team_spirit: params.tuanhun,
        chips: params.chips_on,
        empowers: params.emps
      });

      var editing = state.editingPlan;
      var uploadingLocalId = state.uploadingLocalId;
      var payload = {
        action: editing ? 'edit' : 'submit',
        plan_id: editing ? editing.remoteId : undefined,
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : '',
        title: title,
        notes: notes,
        author: author,
        is_anonymous: isAnon,
        apply_pro: isApplyPro,
        pro_proof: proProofData,
        links: links,
        turnstile_token: CommunityPlans.turnstileState.token || '',
        params: fullParams
      };

      var payloadJson = JSON.stringify(payload);
      if (payloadJson.length > 4.2 * 1024 * 1024) {
        CommunityPlans.turnstileState.isSubmitting = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.classList.remove('is-loading', 'is-success');
          saveBtn.innerHTML = Icons.save + ' 确认保存';
        }
        CommunityPlans.toast('提交内容与截图载荷过大，请压缩截图分辨率后重试');
        return;
      }

      var reqHeaders = Utils.getApiHeaders(true);
      if (CommunityPlans.turnstileState.token) {
        reqHeaders['X-Turnstile-Token'] = CommunityPlans.turnstileState.token;
      }

      state._ownedMutationEpoch = (state._ownedMutationEpoch || 0) + 1;
      fetch('/api/plans', {
        method: 'POST',
        headers: reqHeaders,
        body: payloadJson
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok || !resObj.data || resObj.data.success === false) {
            CommunityPlans.turnstileState.isSubmitting = false;
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.classList.remove('is-loading', 'is-success');
              saveBtn.innerHTML = Icons.save + ' 确认保存';
            }
            var errMsg = (resObj.data && resObj.data.message) ? resObj.data.message : '';
            if (!errMsg) {
              if (resObj.status === 413) errMsg = '提交数据过大 (HTTP 413)，请更换更小的截图后重试';
              else if (resObj.status >= 500) errMsg = '社区服务暂时繁忙或维护中 (HTTP ' + resObj.status + ')，请稍后重试';
              else errMsg = '提交未通过 (HTTP ' + resObj.status + ')';
            }
            CommunityPlans.toast(errMsg);
            if (tsRequired) {
              CommunityPlans.resetTurnstileWidget();
            }
            return;
          }

          state._ownedMutationEpoch = (state._ownedMutationEpoch || 0) + 1;
          if (resObj.data && resObj.data.data && resObj.data.data.id) {
            planItem.remote_id = resObj.data.data.id;
            planItem.remote_status = resObj.data.data.status;
            if (!state.ownedRemoteIds) state.ownedRemoteIds = Object.create(null);
            state.ownedRemoteIds[planItem.remote_id] = true;
            planItem.owner_identity_hash = state.currentIdentityHash;
          }

          if (uploadingLocalId) {
            // 本地补传：把云端 id 回填到原来那条，不新增
            var upPlan = state.savedPlans.find(function (x) { return x.id === uploadingLocalId; });
            if (upPlan) {
              upPlan.remote_id = planItem.remote_id;
              upPlan.remote_status = planItem.remote_status;
              upPlan.owner_identity_hash = state.currentIdentityHash;
              upPlan.title = planItem.title;
              upPlan.notes = planItem.notes;
              upPlan.build_sig = planItem.build_sig;
              upPlan.links = planItem.links;
              upPlan.author = planItem.author;
              upPlan.is_anonymous = planItem.is_anonymous;
            }
            state.uploadingLocalId = null;
          } else if (editing) {
            // 编辑模式：覆盖本地那条，不新增
            var existPlan = state.savedPlans.find(function (x) { return x.id === editing.localId; });
            if (existPlan) {
              existPlan.title = planItem.title;
              existPlan.notes = planItem.notes;
              existPlan.params = planItem.params;
              existPlan.build_sig = planItem.build_sig;
              existPlan.links = planItem.links;
              existPlan.author = planItem.author;
              existPlan.is_anonymous = planItem.is_anonymous;
              existPlan.remote_id = editing.remoteId;
              existPlan.remote_status = planItem.remote_status || 'pending_review';
              existPlan.owner_identity_hash = state.currentIdentityHash;
              existPlan.reject_reason = '';
              existPlan.review_notes = '';
              existPlan.edit_count = (Number(existPlan.edit_count) || 0) + 1;
              existPlan.last_edited_at = Date.now();
            }
            state.editingPlan = null;
            CommunityPlans.hideEditingBar();
          } else {
            state.savedPlans.unshift(planItem);
          }
          Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);

          var editingWas = Boolean(editing);
          var uploadingWas = Boolean(uploadingLocalId);
          var finishSuccess = function () {
            state._saveSuccessTimer = null;
            CommunityPlans.turnstileState.isSubmitting = false;
            // 成功后再销毁弹窗与内存截图，绝不保留原图在本地
            CommunityPlans.closeSaveModal();
            CommunityPlans.renderPlans();
            var msg = uploadingWas
              ? ('方案「' + title + '」已上传到云端，等待审核')
              : (editingWas
              ? ('方案「' + title + '」已更新，重新进入审核队列')
              : (isApplyPro
                  ? '方案「' + title + '」已保存并提交国服自证审核！'
                  : '方案「' + title + '」已保存并提交内容安全审核！'));
            CommunityPlans.toast(msg);
            CommunityPlans.fetchRemotePlans(state.currentCarId);
          };

          if (saveBtn && saveBtn.isConnected) {
            saveBtn.classList.remove('is-loading');
            saveBtn.classList.add('is-success');
            saveBtn.innerHTML = '<span class="cp-save-ok-ico">' + Icons.check + '</span><span>提交成功</span>';
            var stayMs = cpMotionOK() ? 700 : 120;
            state._saveSuccessTimer = setTimeout(finishSuccess, stayMs);
          } else {
            finishSuccess();
          }
        })
        .catch(function () {
          CommunityPlans.turnstileState.isSubmitting = false;
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.classList.remove('is-loading', 'is-success');
            saveBtn.innerHTML = Icons.save + ' 确认保存';
          }
          CommunityPlans.toast('网络连接异常，暂未能提交至社区服务器；您可重试或关闭上传开关仅存本机');
        });
    },

    /* ======================================================================
       通知中心：审核结果 / 站长批注 / 云端下架，统一进收信箱
       ====================================================================== */
    NOTIF_META: {
      approved: { cls: 'is-approved', tag: '审核通过', text: function (n) { return '《' + n.planTitle + '》已通过审核' + (n.extra || '') + '，已收录到社区方案库。'; } },
      rejected: { cls: 'is-rejected', tag: '未通过', text: function (n) { return '《' + n.planTitle + '》未通过审核：' + (n.extra || '请查看详情'); } },
      annotation: { cls: 'is-annotation', tag: '站长批注', text: function (n) { return '《' + n.planTitle + '》收到站长批注：' + (n.extra || ''); } },
      removed: { cls: 'is-removed', tag: '云端移除', text: function (n) { return '《' + n.planTitle + '》已被管理员从云端移除。'; } }
    },

    loadNotifications: function () {
      var key = state.currentIdentityHash ? STORAGE_KEYS.NOTIFICATIONS + ':' + state.currentIdentityHash : '';
      var list = key ? Utils.getStorage(key, []) : [];
      state.notifications = Array.isArray(list) ? list.filter(function (n) { return n && n.id; }) : [];
      CommunityPlans.updateNotifBadge();
    },

    saveNotifications: function () {
      // 只保留最近 60 条，避免 localStorage 膨胀
      state.notifications = state.notifications.slice(0, 60);
      if (state.currentIdentityHash) Utils.setStorage(STORAGE_KEYS.NOTIFICATIONS + ':' + state.currentIdentityHash, state.notifications);
      CommunityPlans.updateNotifBadge();
    },

    pushNotification: function (type, planTitle, carName, extra) {
      if (!CommunityPlans.NOTIF_META[type]) return;
      var n = {
        id: 'ntf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
        type: type,
        planTitle: planTitle || '未命名方案',
        carName: carName || '',
        extra: extra || '',
        ts: Date.now(),
        read: false
      };
      state.notifications.unshift(n);
      CommunityPlans.saveNotifications();
      return n;
    },

    updateNotifBadge: function () {
      var dot = document.getElementById('notifDot');
      if (dot) dot.hidden = !state.notifications.some(function (n) { return !n.read; });
    },

    formatNotifTime: function (ts) {
      try {
        var d = new Date(ts);
        var pad = function (v) { return ('0' + v).slice(-2); };
        return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      } catch (_) { return ''; }
    },

    buildNotifListHtml: function (list) {
      if (!list.length) return '<div class="cp-notif-empty">暂时没有通知</div>';
      return '<div class="cp-notif-list">' + list.map(function (n) {
        var meta = CommunityPlans.NOTIF_META[n.type] || CommunityPlans.NOTIF_META.annotation;
        var text = meta.text(n);
        return '<div class="cp-notif-item ' + meta.cls + '">'
          + '<div class="cp-notif-body">'
          + '<div class="cp-notif-title"><span class="cp-notif-tag ' + meta.cls + '">' + meta.tag + '</span>'
          + '<b>' + Utils.escapeHtml(n.planTitle) + '</b></div>'
          + '<div class="cp-notif-text">' + Utils.escapeHtml(text) + '</div>'
          + '<div class="cp-notif-time">' + (n.carName ? Utils.escapeHtml(n.carName) + ' · ' : '') + CommunityPlans.formatNotifTime(n.ts) + '</div>'
          + '</div></div>';
      }).join('') + '</div>';
    },

    // 有未读时自动弹一次（多条合并进同一个弹窗）
    maybeShowNotificationPopup: function () {
      var unread = state.notifications.filter(function (n) { return !n.read; });
      if (!unread.length) return;
      if (document.getElementById('cpNotifModal')) return;
      CommunityPlans.openNotificationCenter(true);
    },

    openNotificationCenter: function (onlyUnread) {
      var old = document.getElementById('cpNotifModal');
      if (old) old.remove();

      var list = onlyUnread === true
        ? state.notifications.filter(function (n) { return !n.read; })
        : state.notifications;
      var unreadCount = state.notifications.filter(function (n) { return !n.read; }).length;
      var title = onlyUnread === true ? ('您有 ' + list.length + ' 条新通知') : '通知收信箱';
      // 通知弹窗保持与公告默认级别一致的描边，不按内容染边（避免整窗泛金/泛绿）
      var levelCls = '';

      var modal = document.createElement('div');
      modal.id = 'cpNotifModal';
      modal.className = 'cp-modal-overlay is-open';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.onclick = function (e) { if (e.target === modal) CommunityPlans.closeNotificationCenter(); };
      modal.innerHTML = [
        '<div class="card cp-modal-dialog cp-ann-dialog ' + levelCls + '">',
        '  <div class="cp-modal-head">',
        '    <div class="cp-ann-head-left">',
        '      <span class="cp-ann-level-pill ' + levelCls + '">' + Icons.bell + '<span>通知</span></span>',
        '      <h4 class="cp-modal-title">' + Utils.escapeHtml(title) + '</h4>',
        '    </div>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close" aria-label="关闭通知">' + Icons.close + '</button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        CommunityPlans.buildNotifListHtml(list),
        '  </div>',
        '  <div class="cp-modal-footer cp-ann-footer">',
        '    <div class="cp-ann-footer-left"></div>',
        '    <div class="cp-ann-footer-actions">',
        (unreadCount > 1 ? '<button type="button" class="nav-btn cp-btn cp-notif-mark-all">全部标为已读</button>' : ''),
        '      <button type="button" class="nav-btn cp-btn cp-btn-save">' + Icons.check + ' 我知道了</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
      var nDlg = modal.querySelector('.cp-modal-dialog');
      if (nDlg) nDlg.addEventListener('click', function (e) { e.stopPropagation(); });
      var nClose = modal.querySelector('.cp-modal-close');
      if (nClose) nClose.addEventListener('click', function () { CommunityPlans.closeNotificationCenter(); });
      var nMarkAll = modal.querySelector('.cp-notif-mark-all');
      if (nMarkAll) nMarkAll.addEventListener('click', function () { CommunityPlans.markAllNotifRead(); });
      var nOk = modal.querySelector('.cp-btn-save');
      if (nOk) nOk.addEventListener('click', function () { CommunityPlans.closeNotificationCenter(); });
      document.body.classList.add('cp-modal-locked');
      CommunityPlans.markAllNotifRead();
    },

    markAllNotifRead: function () {
      var changed = false;
      state.notifications.forEach(function (n) { if (!n.read) { n.read = true; changed = true; } });
      if (changed) CommunityPlans.saveNotifications();
    },

    closeNotificationCenter: function () {
      var modal = document.getElementById('cpNotifModal');
      if (modal) modal.remove();
      document.body.classList.remove('cp-modal-locked');
      CommunityPlans.updateNotifBadge();
    },

    // 对比前后状态，生成通知；首次同步只建立基线不推通知，避免一打开就炸出一堆历史
    detectNotifications: function (before, after, info) {
      // 只有本地从没记录过远端状态时才视为基线（首次见到这条方案），不推通知。
      // 之前用的是全局 _notifBaselineDone，会把「页面首次同步前刚发生的驳回」一并吞掉。
      if (!before || !before.remote_status) return;
      var title = (after && after.title) || (before && before.title) || '未命名方案';
      var carName = (after && after.car_name) || (before && before.car_name) || '';

      var oldStatus = before ? before.remote_status : null;
      var newStatus = after ? after.remote_status : null;

      if (newStatus && oldStatus !== newStatus) {
        if (newStatus === 'approved') {
          var extra = info && info.is_partner ? '，并授予「友站分享」勋标' : (info && info.is_pro ? '，并荣获「国服顶尖」勋标' : '');
          CommunityPlans.pushNotification('approved', title, carName, extra);
        } else if (newStatus === 'rejected') {
          CommunityPlans.pushNotification('rejected', title, carName, (info && (info.reject_reason || info.review_notes)) || '请查看详情');
        } else if (newStatus === 'cleaned') {
          CommunityPlans.pushNotification('removed', title, carName, '');
        }
      }

      // 批注：用最后一条批注 id 判断是否有新增
      var oldAnnos = (before && Array.isArray(before.annotations)) ? before.annotations : [];
      var newAnnos = (after && Array.isArray(after.annotations)) ? after.annotations : [];
      var oldLast = oldAnnos.length ? oldAnnos[oldAnnos.length - 1].id : '';
      var newLast = newAnnos.length ? newAnnos[newAnnos.length - 1].id : '';
      if (newLast && newLast !== oldLast) {
        var latest = newAnnos[newAnnos.length - 1];
        CommunityPlans.pushNotification('annotation', title, carName, latest.content || '');
      }
    },

    // 使用先前经服务端验证的摘要恢复离线索引；不会把其他身份的记录显示为本人。
    restoreOwnedOffline: function () {
      if (!window.crypto || !crypto.subtle || typeof TextEncoder === 'undefined') return;
      var token;
      try { token = localStorage.getItem('arc_user_identity_v1'); } catch (_) { return; }
      if (!/^[a-f0-9]{64}$/.test(token || '')) return;
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)).then(function (digest) {
        try { if (localStorage.getItem('arc_user_identity_v1') !== token) return; } catch (_) { return; }
        var hash = Array.from(new Uint8Array(digest), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
        if (state.currentIdentityHash && state.currentIdentityHash !== hash) return;
        var ids = state.ownedRemoteIds || Object.create(null);
        state.savedPlans.forEach(function (item) {
          if (item && item.remote_id && item.owner_identity_hash === hash && item.remote_status !== 'cleaned') ids[item.remote_id] = true;
        });
        state.currentIdentityHash = hash;
        state.ownedRemoteIds = ids;
        CommunityPlans.loadNotifications();
        CommunityPlans.renderPlans({ preserveScroll: true });
      }).catch(function () {});
    },

    // 以服务器验证的身份恢复本人所有方案，包括待审与驳回记录。
    syncOwnedPlans: function (force) {
      var now = Date.now();
      if (state._syncingOwned || (!force && state._ownedSyncAt && now - state._ownedSyncAt < 60000)) return;
      state._syncingOwned = true;
      var syncHeaders = Utils.getApiHeaders(false);
      var syncToken = syncHeaders['X-User-Identity'] || '';
      var identityEpoch = state._identityEpoch || 0;
      if (!Utils.identityMatches(syncToken)) { state._syncingOwned = false; state.identityApiReady = false; return; }
      var syncEpoch = state._ownedMutationEpoch || 0;
      var needsResync = false;
      var initialIds = Object.create(null);
      state.savedPlans.forEach(function (item) { if (item && item.remote_id) initialIds[item.remote_id] = item; });
      var fetched = [];
      var identityHash = '';
      function syncStillCurrent() {
        return Utils.identityMatches(syncToken) && (state._identityEpoch || 0) === identityEpoch && (state._ownedMutationEpoch || 0) === syncEpoch;
      }
      function load(page) {
        if (!syncStillCurrent()) return Promise.reject(new Error('identity_changed_during_sync'));
        return fetch('/api/plans?mine=1&page=' + page + '&limit=50', { method: 'GET', cache: 'no-store', headers: syncHeaders })
          .then(Utils.parseJsonSafe).then(function (res) {
            if (!syncStillCurrent()) throw new Error('identity_changed_during_sync');
            var data = res && res.data && res.data.data;
            if (!res.ok || !res.data.success || !data || data.identity_version !== 1 || !/^[a-f0-9]{64}$/.test(data.identity_hash || '') || !Array.isArray(data.items)) throw new Error('identity_sync_unavailable');
            if (identityHash && identityHash !== data.identity_hash) throw new Error('identity_changed_during_sync');
            identityHash = data.identity_hash;
            fetched = fetched.concat(data.items);
            if (data.has_more && page < 40) return load(page + 1);
            if (data.has_more) throw new Error('identity_sync_limit');
          });
      }
      load(1).then(async function () {
        if (!syncStillCurrent()) { state._ownedSyncAt = 0; needsResync = true; return; }
        var ids = Object.create(null);
        var approvedCurrentCar = false;
        fetched.forEach(function (item) { if (item && Utils.safeId(item.id)) ids[item.id] = true; });
        var missing = state.savedPlans.filter(function (item) {
          return item && item.remote_id && initialIds[item.remote_id] === item && item.owner_identity_hash === identityHash && !ids[item.remote_id] && item.remote_status !== 'cleaned';
        });
        var checkedMissing = [];
        for (var offset = 0; offset < missing.length; offset += 20) {
          var batch = missing.slice(offset, offset + 20);
          var confirmed = null;
          try {
            var response = await fetch('/api/plans?check_statuses=' + encodeURIComponent(batch.map(function (item) { return item.remote_id; }).join(',')), { method: 'GET', cache: 'no-store', headers: syncHeaders });
            var parsed = await Utils.parseJsonSafe(response);
            if (parsed.ok && parsed.data && parsed.data.success && parsed.data.data) confirmed = parsed.data.data.items;
          } catch (_) {}
          if (!syncStillCurrent()) { state._ownedSyncAt = 0; needsResync = true; return; }
          checkedMissing.push({ batch: batch, confirmed: confirmed });
        }
        if (!syncStillCurrent()) { state._ownedSyncAt = 0; needsResync = true; return; }
        if (state.currentIdentityHash !== identityHash) {
          state.currentIdentityHash = identityHash;
          CommunityPlans.loadNotifications();
        }
        fetched.forEach(function (item) {
          if (!item || !Utils.safeId(item.id)) return;
          ids[item.id] = true;
          var existing = state.savedPlans.find(function (p) { return p && p.remote_id === item.id; });
          var before = existing && existing.owner_identity_hash === identityHash ? {
            remote_status: existing.remote_status, title: existing.title, car_name: existing.car_name,
            annotations: Array.isArray(existing.annotations) ? existing.annotations.slice() : []
          } : null;
          if (before && before.remote_status !== 'approved' && item.status === 'approved' && String(item.car_id) === String(state.currentCarId)) approvedCurrentCar = true;
          if (!existing) {
            existing = { id: Utils.uuid(), remote_id: item.id };
            state.savedPlans.unshift(existing);
          }
          existing.car_id = item.car_id;
          existing.car_name = item.car_name;
          existing.title = item.title;
          existing.notes = item.notes || '';
          existing.author = item.author;
          existing.is_anonymous = Boolean(item.is_anonymous);
          existing.params = item.params || {};
          existing.links = item.links || [];
          existing.build_sig = item.build_sig;
          existing.created_at = item.created_at;
          existing.remote_status = item.status;
          existing.owner_identity_hash = identityHash;
          existing.reject_reason = item.reject_reason;
          existing.review_notes = item.review_notes;
          existing.annotations = item.annotations || [];
          existing.edit_count = item.edit_count || 0;
          existing.last_edited_at = item.last_edited_at || null;
          existing.isPro = Boolean(item.is_pro);
          existing.isPartner = Boolean(item.is_partner);
          existing.votes = Number(item.votes) || 0;
          if (before) CommunityPlans.detectNotifications(before, existing, item);
        });
        checkedMissing.forEach(function (checked) {
          checked.batch.forEach(function (item) {
            var result = checked.confirmed && checked.confirmed[item.remote_id];
            if (!result) { ids[item.remote_id] = true; return; }
            if (result.found === false || result.status === 'cleaned') {
              var before = { remote_status: item.remote_status, title: item.title, car_name: item.car_name, annotations: item.annotations || [] };
              item.remote_status = 'cleaned';
              CommunityPlans.detectNotifications(before, item, {});
            } else if (result.viewer_is_author === true) ids[item.remote_id] = true;
            else if (result.viewer_is_author === false) item.owner_identity_hash = '';
            else ids[item.remote_id] = true;
          });
        });
        state.ownedRemoteIds = ids;
        state.currentIdentityHash = identityHash;
        state.identityApiReady = true;
        state._ownedSyncAt = Date.now();
        Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
        CommunityPlans.renderPlans({ preserveScroll: true });
        CommunityPlans.syncPendingPlanStatuses({ force: true });
        if (approvedCurrentCar && state.currentCarId) CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false, preserveScroll: true });
      }).catch(function () {
        if (!syncStillCurrent()) { state._ownedSyncAt = 0; needsResync = true; }
        else state.identityApiReady = false;
      }).finally(function () {
        state._syncingOwned = false;
        if (needsResync || state._resyncForIdentity) {
          state._resyncForIdentity = false;
          setTimeout(function () { CommunityPlans.syncOwnedPlans(true); }, 0);
        }
      });
    },

    // 后台静默批量同步本地方案的真实云端审核状态。
    syncPendingPlanStatuses: function (opts) {
      var force = Boolean(opts && opts.force);
      // 已通过的方案也要跟着查：后台可能下架或删除，之前把 approved 排除掉导致前端一直显示「已收录」
      var pendingPlans = state.savedPlans.filter(function (p) {
        if (!p || !p.remote_id || !state.ownedRemoteIds || !state.ownedRemoteIds[p.remote_id]) return false;
        return p.remote_status !== 'cleaned';
      });
      if (pendingPlans.length === 0) return;

      var now = Date.now();
      if (state._isSyncingStatuses) return;
      // 还在审的方案 4 秒一次；只有已通过/已驳回的，降频到 60 秒一次，避免无谓请求
      var hasUnsettled = pendingPlans.some(function (p) {
        return p.remote_status !== 'approved' && p.remote_status !== 'rejected';
      });
      var throttleMs = hasUnsettled ? 4000 : 60000;
      if (!force && state._lastStatusSyncAt && (now - state._lastStatusSyncAt) < throttleMs) return;

      // 优先检查当前所选车型的待审方案，最多一次批量核验 20 条
      var curIdStr = state.currentCarId ? String(state.currentCarId) : '';
      pendingPlans.sort(function (a, b) {
        var aCur = (curIdStr && String(a.car_id) === curIdStr) ? 1 : 0;
        var bCur = (curIdStr && String(b.car_id) === curIdStr) ? 1 : 0;
        return bCur - aCur || ((Number(b.created_at) || 0) - (Number(a.created_at) || 0));
      });
      var start = (Number(state._statusCursor) || 0) % pendingPlans.length;
      var batch = pendingPlans.slice(start, start + 20);
      if (batch.length < 20 && start > 0) batch = batch.concat(pendingPlans.slice(0, Math.min(start, 20 - batch.length)));
      var ids = batch.map(function (p) { return p.remote_id; });
      var statusHeaders = Utils.getApiHeaders(false);
      var statusToken = statusHeaders['X-User-Identity'] || '';
      var statusIdentityEpoch = state._identityEpoch || 0;
      if (!Utils.identityMatches(statusToken)) return;

      state._isSyncingStatuses = true;
      state._lastStatusSyncAt = now;

      fetch('/api/plans?check_statuses=' + encodeURIComponent(ids.join(',')), {
        method: 'GET',
        cache: 'no-store',
        headers: statusHeaders
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!Utils.identityMatches(statusToken) || (state._identityEpoch || 0) !== statusIdentityEpoch) return;
          if (!resObj.ok || !resObj.data || !resObj.data.success || !resObj.data.data || !resObj.data.data.items) {
            return;
          }
          state._statusCursor = (start + batch.length) % pendingPlans.length;
          var map = resObj.data.data.items;
          var anyChanged = false;
          var anyNewlyApprovedForCurCar = false;
          var rejectedTitles = [];

          batch.forEach(function (lp) {
            var info = map[lp.remote_id];
            if (!info) return;
            var snapBefore = {
              remote_status: lp.remote_status,
              title: lp.title,
              car_name: lp.car_name,
              annotations: Array.isArray(lp.annotations) ? lp.annotations.slice() : []
            };
            if (info.found === false || info.status === 'cleaned') {
              if (lp.remote_status !== 'cleaned') {
                lp.remote_status = 'cleaned';
                delete lp.remote_id;
                anyChanged = true;
              }
              CommunityPlans.detectNotifications(snapBefore, lp, info);
              return;
            }
            if (Array.isArray(info.annotations)) {
              if (JSON.stringify(lp.annotations || []) !== JSON.stringify(info.annotations)) {
                lp.annotations = info.annotations;
                anyChanged = true;
              }
            }
            if (info.status && info.status !== lp.remote_status) {
              lp.remote_status = info.status;
              anyChanged = true;
              if (info.status === 'rejected') {
                lp.reject_reason = info.reject_reason || info.review_notes || '未能通过审核，请查看详情';
                lp.review_notes = info.review_notes || lp.reject_reason;
                rejectedTitles.push(lp.title || '未命名方案');
              }
            } else if (info.status === 'rejected' && (info.reject_reason || info.review_notes)) {
              var nextReason = info.reject_reason || info.review_notes;
              if (lp.reject_reason !== nextReason) {
                lp.reject_reason = nextReason;
                lp.review_notes = info.review_notes || nextReason;
                anyChanged = true;
              }
            }
            if (info.status === 'approved') {
              if (info.is_pro && !lp.isPro) { lp.isPro = true; anyChanged = true; }
              if (info.is_partner && !lp.isPartner) { lp.isPartner = true; anyChanged = true; }
              if (curIdStr && String(lp.car_id) === curIdStr) {
                anyNewlyApprovedForCurCar = true;
              }
            }
            CommunityPlans.detectNotifications(snapBefore, lp, info);
          });

          if (anyChanged) {
            Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            CommunityPlans.renderPlans({ preserveScroll: true });
            if (rejectedTitles.length > 0) {
              CommunityPlans.toast('方案「' + rejectedTitles[0] + '」审核未通过，已显示驳回说明');
            } else if (anyNewlyApprovedForCurCar && state.currentCarId) {
              CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false, preserveScroll: true });
            }
          }
        })
        .catch(function () {})
        .finally(function () {
          state._isSyncingStatuses = false;
          if (!Utils.identityMatches(statusToken) || (state._identityEpoch || 0) !== statusIdentityEpoch) return;
          CommunityPlans.updateNotifBadge();
          setTimeout(function () { CommunityPlans.maybeShowNotificationPopup(); }, 1200);
        });
    },

    // 检查指定方案的审核进度与官方审核组裁决说明
    checkPlanStatus: function (localId, remoteId, e) {
      if (e) e.stopPropagation();
      if (!remoteId) {
        CommunityPlans.toast('该方案尚未同步至云端');
        return;
      }

      CommunityPlans.toast('正在查询方案审核状态...');
      var checkHeaders = Utils.getApiHeaders(false);
      var checkToken = checkHeaders['X-User-Identity'] || '';
      var checkIdentityEpoch = state._identityEpoch || 0;
      fetch('/api/plans?check_status=' + encodeURIComponent(remoteId), {
        method: 'GET',
        cache: 'no-store',
        headers: checkHeaders
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!Utils.identityMatches(checkToken) || (state._identityEpoch || 0) !== checkIdentityEpoch) return;
          if (resObj.status === 404) {
            var missingPlan = state.savedPlans.find(function (p) { return p.id === localId; });
            if (missingPlan) {
              missingPlan.remote_status = 'cleaned';
              delete missingPlan.remote_id;
              Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
              CommunityPlans.renderPlans({ preserveScroll: true });
            }
            CommunityPlans.toast('该方案在云端已不存在或已被清理，已更新本地状态');
            return;
          }
          if (!resObj.ok || !resObj.data || !resObj.data.success || !resObj.data.data) {
            throw new Error((resObj.data && resObj.data.message) || ('HTTP ' + resObj.status));
          }
          var d = resObj.data.data;
          var localPlan = state.savedPlans.find(function (p) { return p.id === localId; });
          if (localPlan) {
            var singleSnap = {
              remote_status: localPlan.remote_status,
              title: localPlan.title,
              car_name: localPlan.car_name,
              annotations: Array.isArray(localPlan.annotations) ? localPlan.annotations.slice() : []
            };
            localPlan.remote_status = d.status;
            localPlan.reject_reason = d.reject_reason || d.review_notes;
            localPlan.review_notes = d.review_notes;
            if (Array.isArray(d.annotations)) localPlan.annotations = d.annotations;
            if (d.edit_count !== undefined) localPlan.edit_count = d.edit_count;
            CommunityPlans.detectNotifications(singleSnap, localPlan, d);
            if (d.status === 'approved' && d.is_pro) {
              localPlan.isPro = true;
            }
            if (d.status === 'approved' && d.is_partner) {
              localPlan.isPartner = true;
            }
            Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            CommunityPlans.renderPlans();
          }

          if (d.status === 'approved') {
            CommunityPlans.toast('恭喜！方案已通过审核' + (d.is_partner ? '，并授予「友站分享」专属勋标！' : (d.is_pro ? '，并荣获「国服顶尖」勋标！' : '，已全网上线！')));
          } else if (d.status === 'rejected') {
            CommunityPlans.showRejectModal(localId);
          } else {
            CommunityPlans.toast('方案正在排队审核中，请耐心等待官方审核员审阅。');
          }
        })
        .catch(function (err) {
          CommunityPlans.toast('查询审核状态失败：' + err.message);
        });
    },

    // 展示官方审核组给出的审核驳回说明模态框
    showRejectModal: function (localId, e) {
      if (e) e.stopPropagation();
      var plan = state.savedPlans.find(function (p) { return p.id === localId; });
      if (!plan) return;

      CommunityPlans.closeRejectModal();

      var reason = plan.reject_reason || plan.review_notes || '未能通过审核，请检查截图或内容合规性后重新尝试。';

      var modal = document.createElement('div');
      modal.id = 'cpRejectModal';
      modal.className = 'cp-modal-overlay is-open';
      modal.addEventListener('wheel', function (ev) {
        if (ev.target === modal) ev.preventDefault();
      }, { passive: false });
      modal.addEventListener('touchmove', function (ev) {
        if (ev.target === modal) ev.preventDefault();
      }, { passive: false });

      document.body.classList.add('cp-modal-locked');
      CommunityPlans._rejectEscKeyHandler = function (ev) {
        if (ev.key === 'Escape' || ev.keyCode === 27) {
          CommunityPlans.closeRejectModal();
        }
      };
      document.addEventListener('keydown', CommunityPlans._rejectEscKeyHandler);

      modal.innerHTML = [
        '<div class="card cp-modal-dialog">',
        '  <div class="cp-modal-head">',
        '    <h4 class="cp-modal-title">方案审核反馈说明</h4>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close" aria-label="关闭弹窗">',
        '      ' + Icons.close,
        '    </button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        '    <div class="cp-reject-feedback-box">',
        '      <div class="cp-reject-status-card">',
        '        <div class="cp-reject-status-label">',
        '          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        '          <span>审核判定：未通过</span>',
        '        </div>',
        '        <span style="font-size:12px;color:var(--ink-2);">方案名称：' + Utils.escapeHtml(plan.title) + '</span>',
        '      </div>',
        '      <div style="font-weight:700;font-size:13px;color:var(--ink);margin-top:4px;">官方审核组反馈说明：</div>',
        '      <div class="cp-reject-reason-body">' + Utils.escapeHtml(reason) + '</div>',
        '      <div class="cp-reject-tip">提示：该方案已安全保存在您的本地浏览器中，不受任何影响。您可以根据上述说明修改配装或重新截取符合标准的大国标截图后再次上传。</div>',
        '    </div>',
        '  </div>',
        '  <div class="cp-modal-footer">',
        '    <button type="button" class="nav-btn cp-btn cp-btn-save">' + Icons.check + ' 我知道了</button>',
        '  </div>',
        '</div>'
      ].join('');

      modal.onclick = function (ev) {
        if (ev.target === modal) CommunityPlans.closeRejectModal();
      };
      document.body.appendChild(modal);
      var rDlg = modal.querySelector('.cp-modal-dialog');
      if (rDlg) rDlg.addEventListener('click', function (e) { e.stopPropagation(); });
      var rClose = modal.querySelector('.cp-modal-close');
      if (rClose) rClose.addEventListener('click', function () { CommunityPlans.closeRejectModal(); });
      var rOk = modal.querySelector('.cp-btn-save');
      if (rOk) rOk.addEventListener('click', function () { CommunityPlans.closeRejectModal(); });
    },

    closeRejectModal: function () {
      var modal = document.getElementById('cpRejectModal');
      if (modal) modal.remove();
      document.body.classList.remove('cp-modal-locked');
      if (CommunityPlans._rejectEscKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._rejectEscKeyHandler);
        CommunityPlans._rejectEscKeyHandler = null;
      }
    },

    // 规范化站点公告元数据结构（兼容历史纯字符串与新版完整弹窗配置）
    normalizeAnnouncementMeta: function (raw) {
      if (typeof raw === 'string') {
        var s = raw.trim();
        return {
          enabled: Boolean(s),
          level: 'info',
          title: '全站重要公告',
          text: s,
          display_mode: 'popup_and_bar',
          trigger_rule: 'every_n_visits',
          visit_interval: 20,
          show_on_first: true,
          cooldown_hours: 24,
          allow_dismiss: true,
          cta_text: '',
          cta_url: '',
          version: 1
        };
      }
      if (!raw || typeof raw !== 'object') {
        return {
          enabled: false,
          level: 'info',
          title: '',
          text: '',
          display_mode: 'popup_and_bar',
          trigger_rule: 'every_n_visits',
          visit_interval: 20,
          show_on_first: true,
          cooldown_hours: 24,
          allow_dismiss: true,
          cta_text: '',
          cta_url: '',
          version: 1
        };
      }
      var cleanUrl = String(raw.cta_url || '').trim();
      if (cleanUrl && !/^https?:\/\/[^\s"'<>`]+$/i.test(cleanUrl)) {
        cleanUrl = '';
      }
      var text = String(raw.text || '').trim();
      return {
        enabled: raw.enabled !== false && Boolean(text),
        level: ['info', 'warning', 'success'].indexOf(raw.level) >= 0 ? raw.level : 'info',
        title: String(raw.title || '全站重要公告').trim() || '全站重要公告',
        text: text,
        display_mode: ['popup_and_bar', 'popup_only', 'bar_only'].indexOf(raw.display_mode) >= 0 ? raw.display_mode : 'popup_and_bar',
        trigger_rule: ['every_n_visits', 'once_per_version', 'cooldown_hours', 'every_visit'].indexOf(raw.trigger_rule) >= 0 ? raw.trigger_rule : 'every_n_visits',
        visit_interval: Math.min(Math.max(parseInt(raw.visit_interval, 10) || 20, 1), 999),
        show_on_first: raw.show_on_first !== false,
        cooldown_hours: Math.min(Math.max(parseInt(raw.cooldown_hours, 10) || 24, 1), 720),
        allow_dismiss: raw.allow_dismiss !== false,
        cta_text: String(raw.cta_text || '').trim(),
        cta_url: cleanUrl,
        version: Number(raw.version) || 1
      };
    },

    // 页面打开时独立拉取站点公告与开关配置
    fetchSiteConfig: function () {
      fetch('/api/plans?meta=site_config', {
        method: 'GET',
        cache: 'no-store',
        headers: Utils.getApiHeaders(false)
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok || !resObj.data) {
            var err = new Error('HTTP ' + resObj.status);
            err.httpStatus = resObj.status;
            err.userMsg = (resObj.data && resObj.data.message) ? resObj.data.message : '';
            throw err;
          }
          var json = resObj.data;
          if (json && json.site_meta && typeof json.site_meta === 'object') {
            state.siteMeta = Object.assign({}, state.siteMeta, json.site_meta);
            var saveModal = document.getElementById('cpSaveModal');
            var chkSync = document.getElementById('cpChkSyncCommunity');
            var tsBox = document.getElementById('cpTurnstileBox');
            if (saveModal && chkSync && chkSync.checked && tsBox) {
              var nextTsReq = state.siteMeta.turnstile_required !== false;
              tsBox.style.display = nextTsReq ? '' : 'none';
              if (nextTsReq && CommunityPlans.turnstileState.widgetId === null) {
                CommunityPlans.renderTurnstileWidget();
              } else if (!nextTsReq) {
                CommunityPlans.turnstileState.token = '';
              }
            }
            CommunityPlans.maybeHandleAnnouncement(true);
            if (window.ArcProfile && window.ArcProfile.configurePrompt) {
              window.ArcProfile.configurePrompt(json.site_meta.profile_prompt || { enabled: true, visit_interval: 5, show_on_first: true, max_shows: 0, delay_seconds: 1, interval_hours: 0 });
            }
            if (state.currentCarId) {
              CommunityPlans.renderPlans({ preserveScroll: true });
            }
          }
        })
        .catch(function () {});
    },

    // 根据后台配置的触发时机（每打开 N 次 / 首次 / 冷却小时 / 每次）判定是否自动弹出全站公告
    maybeHandleAnnouncement: function (allowCountVisit) {
      var ann = CommunityPlans.normalizeAnnouncementMeta(state.siteMeta && state.siteMeta.announcement);
      if (!ann.enabled || !ann.text) return;
      if (ann.display_mode === 'bar_only') return;
      // 如果同一会话里已经针对相同版本评估过，避免切车重复计次弹窗
      if (state._annCheckedVersion === ann.version && state._annSessionCounted) return;
      // 避免打断车友正在填写保存表单
      if (document.getElementById('cpSaveModal') || document.getElementById('cpAnnouncementModal')) return;

      var stored = Utils.getStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, null);
      if (!stored || typeof stored !== 'object' || Number(stored.version) !== ann.version) {
        stored = {
          version: ann.version,
          visits: 0,
          lastShownAt: 0,
          dismissedVersion: 0
        };
      }

      if (allowCountVisit || !state._annSessionCounted) {
        stored.visits = (Number(stored.visits) || 0) + 1;
        state._annSessionCounted = true;
      }
      state._annCheckedVersion = ann.version;

      if (ann.allow_dismiss && Number(stored.dismissedVersion) === ann.version) {
        Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
        return;
      }

      var shouldShow = false;
      var visits = Math.max(1, Number(stored.visits) || 1);
      var lastAt = Number(stored.lastShownAt) || 0;

      if (ann.trigger_rule === 'every_visit') {
        shouldShow = true;
      } else if (ann.trigger_rule === 'once_per_version') {
        shouldShow = !lastAt;
      } else if (ann.trigger_rule === 'cooldown_hours') {
        var cooldownMs = ann.cooldown_hours * 3600 * 1000;
        shouldShow = !lastAt || (Date.now() - lastAt >= cooldownMs);
      } else {
        // 默认 every_n_visits：每打开网站 N 次展示 1 次
        var interval = ann.visit_interval;
        if (ann.show_on_first) {
          shouldShow = (visits === 1) || ((visits - 1) % interval === 0);
        } else {
          shouldShow = (visits % interval === 0);
        }
      }

      if (shouldShow) {
        stored.lastShownAt = Date.now();
        Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
        CommunityPlans.openAnnouncementModal(ann, { fromAuto: true, visits: visits });
      } else {
        Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
      }
    },

    // 打开全站公告弹窗（自动触发或点击横幅主动查看）
    openAnnouncementModal: function (rawAnn, opts) {
      var ann = CommunityPlans.normalizeAnnouncementMeta(rawAnn || (state.siteMeta && state.siteMeta.announcement));
      if (!ann.enabled || !ann.text) return;
      CommunityPlans.closeAnnouncementModal(true);

      var stored = Utils.getStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, {}) || {};
      var isDismissed = ann.allow_dismiss && Number(stored.dismissedVersion) === ann.version;
      var badgeLabel = ann.level === 'warning' ? '重要提醒' : (ann.level === 'success' ? '更新公告' : '全站公告');
      var levelCls = ann.level === 'warning' ? 'is-warn' : (ann.level === 'success' ? 'is-success' : 'is-info');

      var modal = document.createElement('div');
      modal.id = 'cpAnnouncementModal';
      modal.className = 'cp-modal-overlay is-open';
      modal.onclick = function (e) {
        if (e.target === modal) CommunityPlans.closeAnnouncementModal();
      };
      modal.addEventListener('wheel', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });
      modal.addEventListener('touchmove', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });

      document.body.classList.add('cp-modal-locked');
      CommunityPlans._annEscKeyHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          CommunityPlans.closeAnnouncementModal();
        }
      };
      document.addEventListener('keydown', CommunityPlans._annEscKeyHandler);

      var rawCtaUrl = ann.cta_url ? String(ann.cta_url).trim() : '';
      var safeCtaUrl = (/^https?:\/\//i.test(rawCtaUrl) || /^\/(?!\/)/.test(rawCtaUrl)) ? rawCtaUrl : '';
      var ctaHtml = (ann.cta_text && safeCtaUrl)
        ? '<a class="nav-btn cp-btn cp-ann-cta-btn" href="' + Utils.escapeHtml(safeCtaUrl) + '" target="_blank" rel="noopener noreferrer">' + Icons.link + '<span>' + Utils.escapeHtml(ann.cta_text) + '</span></a>'
        : '';

      var dismissHtml = ann.allow_dismiss
        ? '<label class="cp-ann-dismiss-label"><input type="checkbox" id="cpAnnDismissCheck"' + (isDismissed ? ' checked' : '') + '><span>本次公告不再自动弹出</span></label>'
        : '<span class="cp-ann-force-hint">重要通知 · 关闭后到达周期仍将提醒</span>';

      modal.innerHTML = [
        '<div class="card cp-modal-dialog cp-ann-dialog ' + levelCls + '" data-ann-version="' + Utils.escapeHtml(String(ann.version)) + '" data-allow-dismiss="' + (ann.allow_dismiss ? '1' : '0') + '">',
        '  <div class="cp-modal-head">',
        '    <div class="cp-ann-head-left">',
        '      <span class="cp-ann-level-pill ' + levelCls + '">' + Icons.megaphone + '<span>' + badgeLabel + '</span></span>',
        '      <h4 class="cp-modal-title">' + Utils.escapeHtml(ann.title) + '</h4>',
        '    </div>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close" aria-label="关闭公告">',
        '      ' + Icons.close,
        '    </button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        '    <div class="cp-ann-body-card">' + Utils.escapeHtml(ann.text) + '</div>',
        '  </div>',
        '  <div class="cp-modal-footer cp-ann-footer">',
        '    <div class="cp-ann-footer-left">' + dismissHtml + '</div>',
        '    <div class="cp-ann-footer-actions">',
        '      ' + ctaHtml,
        '      <button type="button" class="nav-btn cp-btn cp-btn-save">' + Icons.check + ' 我知道了</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
      var aDlg = modal.querySelector('.cp-modal-dialog');
      if (aDlg) aDlg.addEventListener('click', function (e) { e.stopPropagation(); });
      var aClose = modal.querySelector('.cp-modal-close');
      if (aClose) aClose.addEventListener('click', function () { CommunityPlans.closeAnnouncementModal(); });
      var aOk = modal.querySelector('.cp-btn-save');
      if (aOk) aOk.addEventListener('click', function () { CommunityPlans.closeAnnouncementModal(); });
    },

    closeAnnouncementModal: function (skipPersist) {
      var modal = document.getElementById('cpAnnouncementModal');
      if (modal) {
        if (!skipPersist) {
          var dialog = modal.querySelector('.cp-ann-dialog');
          var chk = document.getElementById('cpAnnDismissCheck');
          if (dialog && chk && dialog.getAttribute('data-allow-dismiss') === '1') {
            var ver = Number(dialog.getAttribute('data-ann-version')) || 1;
            var stored = Utils.getStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, null);
            if (!stored || typeof stored !== 'object') {
              stored = { version: ver, visits: 1, lastShownAt: Date.now(), dismissedVersion: 0 };
            }
            stored.dismissedVersion = chk.checked ? ver : 0;
            Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
          }
        }
        modal.remove();
      }
      document.body.classList.remove('cp-modal-locked');
      if (CommunityPlans._annEscKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._annEscKeyHandler);
        CommunityPlans._annEscKeyHandler = null;
      }
    },

    // 一键套用并记录当前高亮状态与防抄袭指纹来源
    applyPlanById: function (planId) {
      var localFound = state.savedPlans.find(function (p) { return p.id === planId; });
      var remoteFound = state.proPlans.find(function (p) { return p.id === planId; }) ||
                        state.remotePlans.find(function (p) { return p.id === planId; });
      var plan = localFound || remoteFound;
      if (!plan || !plan.params) {
        CommunityPlans.toast('找不到该方案数据');
        return;
      }
      var curCalcMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      if (!isPlanCompatibleWithMode(plan.params, curCalcMode)) {
        CommunityPlans.toast('该方案含团魂或增益装置，请先在顶部切换至「团魂获能」模式', 'warn');
        return;
      }

      state.lastSnapshot = ParamsIO.capture();
      state.hasUndoAvailable = true;
      state.activeAppliedPlanId = planId;
      var isOwnLocal = Boolean(localFound && (!localFound.remote_id || (state.ownedRemoteIds && state.ownedRemoteIds[localFound.remote_id]) || (localFound.remote_status === 'cleaned' && localFound.owner_identity_hash === state.currentIdentityHash)));
      var isOwnRemote = Boolean(remoteFound && remoteFound.viewer_is_author);

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'inline-flex';

      ParamsIO.apply(plan.params);
      var appliedCapture = ParamsIO.capture();
      state.appliedSource = {
        id: plan.id,
        title: plan.title || '他人方案',
        isOther: !isOwnLocal && !isOwnRemote,
        sourceBuildSig: Utils.computeLocalBuildSig(plan.car_id || state.currentCarId, plan.params),
        appliedDomSig: Utils.computeLocalBuildSig(state.currentCarId, appliedCapture)
      };
      CommunityPlans.renderPlans({ preserveScroll: true });
      Draft.scheduleSave();

      var cardChips = document.getElementById('cardChips');
      if (cardChips) {
        cardChips.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      CommunityPlans.toast('已成功套用方案「' + plan.title + '」');
    },

    // 撤销还原
    undoApply: function () {
      if (!state.lastSnapshot) {
        CommunityPlans.toast('暂无可撤销的快照');
        return;
      }

      if (typeof window.setCalcMode === 'function' && state.lastSnapshot.calc_mode &&
          (state.lastSnapshot.calc_mode === 'solo' || state.lastSnapshot.calc_mode === 'team')) {
        var curM = (typeof window.getCalcMode === 'function')
          ? window.getCalcMode()
          : (document.body.getAttribute('data-calc-mode') || 'solo');
        if (curM !== state.lastSnapshot.calc_mode) {
          window.setCalcMode(state.lastSnapshot.calc_mode, true, true);
        }
      }
      ParamsIO.apply(state.lastSnapshot);
      state.lastSnapshot = null;
      state.hasUndoAvailable = false;
      state.activeAppliedPlanId = null;
      state.appliedSource = null;

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'none';

      CommunityPlans.renderPlans({ preserveScroll: true });
      Draft.scheduleSave();
      CommunityPlans.toast('已还原之前的配装状态');
    },

    // 删除本地方案
    deletePlan: function (planId) {
      var idx = state.savedPlans.findIndex(function (p) { return p.id === planId; });
      if (idx === -1) return;

      var target = state.savedPlans[idx];
      var name = target.title;
      var hasRemote = Boolean(target.remote_id && target.remote_status !== 'cleaned');
      var confirmText = hasRemote
        ? ('方案「' + name + '」已上传到社区。\n\n删除会同时从云端移除，且无法恢复。确定继续吗？')
        : ('确定要删除本地保存的方案「' + name + '」吗？');
      if (!confirm(confirmText)) return;

      var removeLocal = function () {
        var i = state.savedPlans.findIndex(function (p) { return p.id === planId; });
        if (i === -1) return;
        state.savedPlans.splice(i, 1);
        Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
        if (state.activeAppliedPlanId === planId) state.activeAppliedPlanId = null;
        if (state.editingPlan && state.editingPlan.localId === planId) state.editingPlan = null;
        CommunityPlans.renderPlans({ preserveScroll: true });
      };

      if (!hasRemote) {
        removeLocal();
        CommunityPlans.toast('已删除方案「' + name + '」');
        return;
      }

      CommunityPlans.toast('正在从云端删除...');
      state._ownedMutationEpoch = (state._ownedMutationEpoch || 0) + 1;
      fetch('/api/plans', {
        method: 'POST',
        headers: Utils.getApiHeaders(true),
        body: JSON.stringify({ action: 'delete', plan_id: target.remote_id })
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          var body = resObj.data || {};
          if (!resObj.ok || !body.success) {
            CommunityPlans.toast('云端删除失败：' + (body.message || ('HTTP ' + resObj.status)));
            return;
          }
          state._ownedMutationEpoch = (state._ownedMutationEpoch || 0) + 1;
          removeLocal();
          CommunityPlans.toast('已从云端与本机删除「' + name + '」');
        })
        .catch(function (err) {
          CommunityPlans.toast('删除失败：' + err.message);
        });
    },

    // 把纯本地方案补传到云端：切车 → 载参数 → 打开保存弹窗并自动勾选同步
    uploadLocalPlan: function (localId) {
      var plan = state.savedPlans.find(function (p) { return p.id === localId; });
      if (!plan) return;
      if (plan.remote_id && plan.remote_status !== 'cleaned') {
        CommunityPlans.toast('该方案已经在云端了');
        return;
      }

      var open = function () {
        try {
          ParamsIO.apply(plan.params);
        } catch (e) {
          CommunityPlans.toast('载入方案参数失败：' + e.message);
          return;
        }
        state.uploadingLocalId = plan.id;
        CommunityPlans.openSaveModal();
        setTimeout(function () {
          var t = document.getElementById('cpInputTitle');
          if (t) { t.value = plan.title || ''; CommunityPlans.onTitleInput(t); }
          var n = document.getElementById('cpInputNotes');
          if (n && plan.notes) { n.value = plan.notes; CommunityPlans.onNotesInput(n); }
          var chk = document.getElementById('cpChkSyncCommunity');
          if (chk && !chk.checked) {
            chk.checked = true;
            try { chk.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
          }
          var btn = document.getElementById('cpBtnConfirmSave');
          if (btn) btn.innerHTML = Icons.upload + ' 完成验证并上传';
        }, 80);
      };

      if (state.currentCarId && String(state.currentCarId) !== String(plan.car_id)) {
        if (typeof window.pickCar === 'function') {
          window.pickCar(plan.car_id);
          setTimeout(open, 420);
        } else {
          CommunityPlans.toast('请先切换到「' + (plan.car_name || '该车') + '」再上传');
        }
        return;
      }
      open();
    },

    // 编辑已上传的方案：把参数载回计算器，保存时走 action=edit，重新进审核队列
    startEditPlan: function (localId) {
      var plan = state.savedPlans.find(function (p) { return p.id === localId; });
      if (!plan) return;
      if (!plan.remote_id) {
        CommunityPlans.toast('该方案只在本地，直接修改后重新保存即可');
        return;
      }
      if (state.currentCarId && String(state.currentCarId) !== String(plan.car_id)) {
        CommunityPlans.toast('请先切换到「' + (plan.car_name || '该车') + '」再编辑这条方案');
        return;
      }
      try {
        ParamsIO.apply(plan.params);
      } catch (e) {
        CommunityPlans.toast('载入方案参数失败：' + e.message);
        return;
      }
      state.editingPlan = {
        localId: plan.id,
        remoteId: plan.remote_id,
        carId: plan.car_id,
        title: plan.title,
        notes: plan.notes
      };
      // 进入编辑态：参数已载入计算器，顶部出现「正在编辑」条，改完点那里的「保存修改」
      CommunityPlans.showEditingBar(plan.title);
      CommunityPlans.closePlansModal && CommunityPlans.closePlansModal();
      try {
        var anchor = document.getElementById('cardCoreParams') || document.querySelector('.ds-c .card');
        if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
      CommunityPlans.toast('已载入「' + plan.title + '」的参数，改完点顶部「保存修改」');
    },

    showEditingBar: function (title) {
      var stale = document.getElementById('cpEditingBar');
      if (stale) stale.remove();
      var bar = document.createElement('div');
      bar.id = 'cpEditingBar';
      bar.className = 'cp-editing-bar';
      bar.setAttribute('data-html2canvas-ignore', 'true');
      // 内联兜底：这个条挂在 body 下、不在 .ds-c 卡片上下文里，类选择器偶发取不到宿主变量
      var ghostStyle = 'height:30px;padding:0 12px;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;'
        + 'border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#c7c7cc;';
      var primaryStyle = 'height:30px;padding:0 12px;border-radius:8px;font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;'
        + 'border:1px solid color-mix(in oklab, var(--acc, #f2a900) 60%, transparent);'
        + 'background:color-mix(in oklab, var(--acc, #f2a900) 22%, rgba(20,20,24,.9));color:#f5f5f7;';
      bar.innerHTML = [
        '<span class="cp-eb-ico">' + Icons.edit + '</span>',
        '<span class="cp-eb-text"><b>正在编辑</b><span>' + Utils.escapeHtml(String(title || '该方案')) + '</span></span>',
        '<span class="cp-eb-actions">',
        '  <button type="button" class="cp-eb-cancel" style="' + ghostStyle + '">取消</button>',
        '  <button type="button" class="cp-eb-save" style="' + primaryStyle + '">保存修改</button>',
        '</span>'
      ].join('');
      document.body.appendChild(bar);
      var ebCancel = bar.querySelector('.cp-eb-cancel');
      if (ebCancel) ebCancel.addEventListener('click', function () { CommunityPlans.cancelEditPlan(); });
      var ebSave = bar.querySelector('.cp-eb-save');
      if (ebSave) ebSave.addEventListener('click', function () { CommunityPlans.openSaveModal(); });
      document.body.classList.add('cp-editing-active');
      requestAnimationFrame(function () { bar.classList.add('is-show'); });
    },

    hideEditingBar: function () {
      var bar = document.getElementById('cpEditingBar');
      document.body.classList.remove('cp-editing-active');
      if (!bar) return;
      bar.classList.remove('is-show');
      setTimeout(function () {
        if (bar.parentNode && !bar.classList.contains('is-show')) bar.remove();
      }, 340);
    },

    // 由主计算器在切车时调用：切到别的车就退出编辑态，避免编辑条一直挂着
    notifyCarChanged: function (carId) {
      if (!state.editingPlan) return;
      if (String(state.editingPlan.carId) === String(carId)) return;
      state.editingPlan = null;
      CommunityPlans.hideEditingBar();
      CommunityPlans.toast('已切换车辆，退出编辑');
    },

    cancelEditPlan: function () {
      state.editingPlan = null;
      CommunityPlans.hideEditingBar();
      CommunityPlans.toast('已退出编辑');
    },

    // 点赞 / 再次点击取消点赞 (绑定设备指纹持久化记忆 + 禁止作者自赞)
    toggleVote: function (planId) {
      var localPlan = state.savedPlans.find(function (p) { return p.id === planId; });
      var remotePlan = state.proPlans.find(function (p) { return p.id === planId; }) ||
                       state.remotePlans.find(function (p) { return p.id === planId; });
      var plan = localPlan || remotePlan;
      if (!plan) return;

      var isOwnLocalWithRemote = Boolean(localPlan && localPlan.remote_id && state.ownedRemoteIds && state.ownedRemoteIds[localPlan.remote_id]);
      if (plan.viewer_is_author || isOwnLocalWithRemote) {
        CommunityPlans.toast('不能给自己的方案点赞');
        return;
      }

      if (localPlan && !localPlan.remote_id) {
        CommunityPlans.toast('本地方案仅您自己可见，上传社区后可接收点赞');
        return;
      }

      if (state.siteMeta && state.siteMeta.allow_voting === false) {
        CommunityPlans.toast('当前站点暂未开放点赞功能');
        return;
      }

      var targetRemoteId = plan.remote_id || plan.id;
      if (!state.votingMap) state.votingMap = {};
      if (state.votingMap[planId]) return;
      state.votingMap[planId] = true;

      var prevVoted = Boolean(plan.isVoted || state.votedMap[plan.id] || state.votedMap[targetRemoteId]);
      var prevVotes = Math.max(0, Number(plan.votes) || 0);
      var nextAction = prevVoted ? 'unvote' : 'vote';
      var nextVoted = !prevVoted;
      var optimisticVotes = nextVoted ? prevVotes + 1 : Math.max(0, prevVotes - 1);

      plan.isVoted = nextVoted;
      plan.votes = optimisticVotes;
      if (nextVoted) {
        state.votedMap[plan.id] = 1;
        state.votedMap[targetRemoteId] = 1;
      } else {
        delete state.votedMap[plan.id];
        delete state.votedMap[targetRemoteId];
      }
      Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
      state._pendingVoteFx = {
        planId: planId,
        from: prevVotes,
        to: optimisticVotes,
        burst: nextVoted
      };
      CommunityPlans.renderPlans({ preserveScroll: true });

      fetch('/api/vote', {
        method: 'POST',
        headers: Utils.getApiHeaders(true),
        body: JSON.stringify({ plan_id: targetRemoteId, action: nextAction })
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok) {
            if (resObj.status === 409 || (resObj.data && resObj.data.code === 'ALREADY_VOTED')) {
              plan.isVoted = true;
              plan.votes = Math.max(1, prevVotes);
              state.votedMap[plan.id] = 1;
              state.votedMap[targetRemoteId] = 1;
              Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
              CommunityPlans.renderPlans({ preserveScroll: true });
              CommunityPlans.toast((resObj.data && resObj.data.message) || '您已赞过该方案');
              return;
            }
            // 后端拒绝（例如自赞 403、限流 429 或未找到对应指纹点赞记录）：精确回滚
            plan.isVoted = prevVoted;
            plan.votes = prevVotes;
            if (prevVoted) {
              state.votedMap[plan.id] = 1;
              state.votedMap[targetRemoteId] = 1;
            } else {
              delete state.votedMap[plan.id];
              delete state.votedMap[targetRemoteId];
            }
            Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
            state._pendingVoteFx = {
              planId: planId,
              from: optimisticVotes,
              to: prevVotes,
              burst: false
            };
            CommunityPlans.renderPlans({ preserveScroll: true });
            CommunityPlans.toast((resObj.data && resObj.data.message) || '操作失败，请稍后重试');
            return;
          }
          var d = resObj.data && resObj.data.data ? resObj.data.data : {};
          var changedByServer = false;
          var beforeServerVotes = plan.votes;
          if (typeof d.voted === 'boolean') {
            if (plan.isVoted !== d.voted) changedByServer = true;
            plan.isVoted = d.voted;
            if (d.voted) {
              state.votedMap[plan.id] = 1;
              state.votedMap[targetRemoteId] = 1;
            } else {
              delete state.votedMap[plan.id];
              delete state.votedMap[targetRemoteId];
            }
            Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
          }
          if (typeof d.votes === 'number') {
            if (plan.votes !== d.votes) changedByServer = true;
            plan.votes = d.votes;
          }
          if (changedByServer) {
            state._pendingVoteFx = {
              planId: planId,
              from: beforeServerVotes,
              to: plan.votes,
              burst: false
            };
            CommunityPlans.renderPlans({ preserveScroll: true });
          }
          CommunityPlans.toast(plan.isVoted ? '点赞成功 +1' : '已取消点赞');
        })
        .catch(function () {
          plan.isVoted = prevVoted;
          plan.votes = prevVotes;
          if (prevVoted) {
            state.votedMap[plan.id] = 1;
            state.votedMap[targetRemoteId] = 1;
          } else {
            delete state.votedMap[plan.id];
            delete state.votedMap[targetRemoteId];
          }
          Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
          state._pendingVoteFx = {
            planId: planId,
            from: optimisticVotes,
            to: prevVotes,
            burst: false
          };
          CommunityPlans.renderPlans({ preserveScroll: true });
          CommunityPlans.toast('网络波动，操作已回滚，请重试');
        })
        .finally(function () {
          if (state.votingMap) delete state.votingMap[planId];
        });
    },

    // 测量每个 .cp-section 内图标底边与方案卡左侧坐标，单图层绘制连续弧线树干（先统一读、后统一写，避免强制同步布局抖动）
    _layoutTreeLines: function () {
      var stream = document.getElementById('cpSectionsStream');
      if (!stream || stream.offsetWidth === 0) return;

      var getRelBox = function (el, ancestor) {
        var x = 0;
        var y = 0;
        var cur = el;
        while (cur && cur !== ancestor) {
          x += cur.offsetLeft || 0;
          y += cur.offsetTop || 0;
          cur = cur.offsetParent;
        }
        return { x: x, y: y, w: el.offsetWidth || 0, h: el.offsetHeight || 0 };
      };

      var secs = stream.querySelectorAll('.cp-section');
      var removals = [];
      var drawJobs = [];

      // 阶段 1：统一读取布局坐标，严禁在此循环中写入 DOM
      for (var i = 0; i < secs.length; i++) {
        var sec = secs[i];
        var iconEl = sec.querySelector('.cp-sec-header > .cp-sec-icon-box, .cp-sec-header > .cp-sec-pro-icon');
        var listEl = sec.querySelector('.cp-sec-list');
        var svg = sec.querySelector(':scope > .cp-tree-svg');

        if (!iconEl || !listEl || listEl.offsetHeight === 0) {
          if (svg) removals.push(svg);
          continue;
        }

        var cards = listEl.querySelectorAll(':scope > .cp-card-item');
        var anchors = [];
        for (var c = 0; c < cards.length; c++) {
          if (cards[c].offsetHeight === 0) continue;
          var cBox = getRelBox(cards[c], sec);
          anchors.push({ x: cBox.x, y: cBox.y + 22 });
        }

        if (!anchors.length) {
          if (svg) removals.push(svg);
          continue;
        }

        var iBox = getRelBox(iconEl, sec);
        var cx = Math.round((iBox.x + iBox.w / 2) * 2) / 2;
        var topY = iBox.y + iBox.h;
        var dx = Math.max(8, anchors[0].x - cx);
        var baseR = Math.min(10, Math.max(6, dx - 2));

        drawJobs.push({
          sec: sec,
          svg: svg,
          cx: cx,
          topY: topY,
          baseR: baseR,
          anchors: anchors
        });
      }

      // 阶段 2：统一写入 SVG DOM，无变动时跳过 setAttribute 避免重复绘制
      for (var r = 0; r < removals.length; r++) {
        removals[r].remove();
      }

      var svgNs = 'http://www.w3.org/2000/svg';
      for (var k = 0; k < drawJobs.length; k++) {
        var job = drawJobs[k];
        var dParts = [];
        var last = job.anchors[job.anchors.length - 1];
        var lastR = Math.min(job.baseR, Math.max(4, last.y - job.topY));
        var lastBendY = Math.max(job.topY, last.y - lastR);

        // 主干竖线与末项圆角 L 型分支整合为一笔连续路径，彻底避免接缝与断点
        dParts.push(
          'M ' + job.cx + ' ' + job.topY +
          ' L ' + job.cx + ' ' + lastBendY +
          ' A ' + lastR + ' ' + lastR + ' 0 0 0 ' + (job.cx + lastR) + ' ' + last.y +
          ' L ' + last.x + ' ' + last.y
        );

        // 非末项均由主干切线顺滑弯出同款圆弧连入卡片
        for (var j = 0; j < job.anchors.length - 1; j++) {
          var pt = job.anchors[j];
          var br = Math.min(job.baseR, Math.max(4, pt.y - job.topY));
          dParts.push(
            'M ' + job.cx + ' ' + (pt.y - br) +
            ' A ' + br + ' ' + br + ' 0 0 0 ' + (job.cx + br) + ' ' + pt.y +
            ' L ' + pt.x + ' ' + pt.y
          );
        }

        var dStr = dParts.join(' ');
        var targetSvg = job.svg;
        if (!targetSvg) {
          targetSvg = document.createElementNS(svgNs, 'svg');
          targetSvg.setAttribute('class', 'cp-tree-svg');
          targetSvg.setAttribute('aria-hidden', 'true');
          targetSvg.setAttribute('shape-rendering', 'geometricPrecision');
          var pathEl = document.createElementNS(svgNs, 'path');
          targetSvg.appendChild(pathEl);
          job.sec.insertBefore(targetSvg, job.sec.firstChild);
        }
        var p = targetSvg.querySelector('path');
        if (p && p.getAttribute('d') !== dStr) {
          p.setAttribute('d', dStr);
        }
      }
    },

    _scheduleTreeLayout: function () {
      if (state._treeRaf) cancelAnimationFrame(state._treeRaf);
      state._treeRaf = requestAnimationFrame(function () {
        state._treeRaf = 0;
        CommunityPlans._layoutTreeLines();
      });
    },

    _bindTreeResizeObserver: function () {
      var viewport = document.getElementById('cpScrollViewport');
      if (!viewport) return;
      if (!state._treeResizeBound) {
        state._treeResizeBound = true;
        window.addEventListener('resize', CommunityPlans._scheduleTreeLayout);
      }
      if (typeof ResizeObserver === 'function') {
        if (state._treeRo) state._treeRo.disconnect();
        state._treeRo = new ResizeObserver(function () {
          CommunityPlans._scheduleTreeLayout();
        });
        state._treeRo.observe(viewport);
        var secs = viewport.querySelectorAll('.cp-section');
        for (var i = 0; i < secs.length; i++) {
          state._treeRo.observe(secs[i]);
        }
      }
    },

    // 统一 Toast 提示 (优先委托全局 showToast，确保定时器清理、图标装饰与最高层 z-index 一致)
    toast: function (msg) {
      if (typeof window.showToast === 'function') {
        window.showToast(msg);
        return;
      }
      var toastEl = document.getElementById('copyToast');
      if (toastEl) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        if (toastEl.__hideTimer) clearTimeout(toastEl.__hideTimer);
        if (toastEl.__timer) clearTimeout(toastEl.__timer);
        toastEl.__hideTimer = setTimeout(function () {
          toastEl.classList.remove('show');
        }, 2500);
      } else {
        alert(msg);
      }
    }
  };

  // 挂载到全局
  window.CommunityPlans = CommunityPlans;
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-anno-reply]');
    if (button) CommunityPlans.replyAnnotation(button.dataset.localId, button.dataset.annoReply);
  });
  window.toggleAutoDraft = Draft.toggle;
  window.paintAutoDraft = Draft.paintSwitch;

  // DOM 就绪时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', CommunityPlans.init);
  } else {
    CommunityPlans.init();
  }

})(window, document);
