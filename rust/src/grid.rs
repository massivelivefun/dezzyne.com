use crate::spring::Spring;

pub const CAM_FLOATS: usize = 20;
pub const MAJOR_STEP: f32 = 4.0;
pub const FLOOR_Y: f32 = -1.55;
pub const TAN_HALF_FOV: f32 = 0.58;

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LightState {
    Hidden,
    Cursor,
    ToObject,
    LockedObject,
    ToCursor,
}

pub struct GridCamera {
    cam_x: Spring,
    cam_y: Spring,
    cam_yaw: Spring,
    cam_pitch: Spring,
    cam_roll: Spring,
    light_state: LightState,
    has_floor_pos: bool,
    free_x: f32,
    free_z: f32,
    anchor_x: f32,
    anchor_z: f32,
    anchor_blend: Spring,
    cursor_glow: Spring,
    scroll_z: f32,
    cam_buf: [f32; CAM_FLOATS],
}

impl GridCamera {
    pub const fn new() -> Self {
        Self {
            cam_x: Spring::new(0.0),
            cam_y: Spring::new(0.0),
            cam_yaw: Spring::new(0.0),
            cam_pitch: Spring::new(-0.14),
            cam_roll: Spring::new(0.0),
            light_state: LightState::Hidden,
            has_floor_pos: false,
            free_x: 0.0,
            free_z: 8.0,
            anchor_x: 0.0,
            anchor_z: 4.35,
            anchor_blend: Spring::new(0.0),
            cursor_glow: Spring::new(0.0),
            scroll_z: 0.0,
            cam_buf: [0.0; CAM_FLOATS],
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn step_camera(
        &mut self,
        safe_dt: f32,
        motion_scale: f32,
        time: f32,
        width: f32,
        height: f32,
        mouse_x: f32,
        mouse_y: f32,
        pointer_active: bool,
        snap: bool,
    ) {
        let w = width.max(1.0);
        let h = height.max(1.0);
        let mobile_mix = ((900.0 - w) / 300.0).clamp(0.0, 1.0);

        let sway_amp_x = 0.06 + mobile_mix * 0.42;
        let sway_amp_y = 0.025 + mobile_mix * 0.035;
        let sway_freq = 0.32 + mobile_mix * 0.16;

        let primary_x = (time * sway_freq).sin();
        let harmonic_x = (time * sway_freq * 0.53 + 1.1).sin() * 0.20;
        let idle_sway_x =
            (primary_x + harmonic_x) * (sway_amp_x / 1.20) * motion_scale;
        let idle_sway_y = (time * 0.26).cos() * sway_amp_y * motion_scale;

        let (nx, ny) = if pointer_active {
            (
                (((mouse_x / w) - 0.5) * 2.0).clamp(-1.0, 1.0),
                (((mouse_y / h) - 0.5) * 2.0).clamp(-1.0, 1.0),
            )
        } else {
            (idle_sway_x, idle_sway_y)
        };

        let dolly_x = 0.52 + mobile_mix * 0.48;
        let yaw_gain = 0.082 - mobile_mix * 0.140;
        let roll_gain = 0.018 + mobile_mix * 0.008;

        self.cam_x.target = nx * dolly_x;
        self.cam_y.target = -ny * 0.20;
        self.cam_yaw.target = nx * yaw_gain;
        self.cam_pitch.target = -0.14 - ny * 0.052;
        self.cam_roll.target = -nx * roll_gain;

        if snap {
            self.cam_x.snap(self.cam_x.target);
            self.cam_y.snap(self.cam_y.target);
            self.cam_yaw.snap(self.cam_yaw.target);
            self.cam_pitch.snap(self.cam_pitch.target);
            self.cam_roll.snap(self.cam_roll.target);
            self.light_state = LightState::Hidden;
            self.has_floor_pos = false;
            self.anchor_blend.snap(0.0);
            self.cursor_glow.snap(0.0);
        } else if pointer_active {
            self.cam_x.step(safe_dt, 62.0, 15.7);
            self.cam_y.step(safe_dt, 62.0, 15.7);
            self.cam_yaw.step(safe_dt, 58.0, 15.2);
            self.cam_pitch.step(safe_dt, 58.0, 15.2);
            self.cam_roll.step(safe_dt, 52.0, 14.4);
        } else {
            self.cam_x.step(safe_dt, 24.0, 9.8);
            self.cam_y.step(safe_dt, 24.0, 9.8);
            self.cam_yaw.step(safe_dt, 22.0, 9.4);
            self.cam_pitch.step(safe_dt, 22.0, 9.4);
            self.cam_roll.step(safe_dt, 20.0, 8.9);
        }

        let travel = safe_dt * 0.85 * motion_scale;
        self.scroll_z = (self.scroll_z + travel).rem_euclid(MAJOR_STEP);

        let (sy, cy) = self.cam_yaw.pos.sin_cos();
        let (sp, cp) = self.cam_pitch.pos.sin_cos();
        let (sr, cr) = self.cam_roll.pos.sin_cos();

        let fx = sy * cp;
        let fy = sp;
        let fz = cy * cp;

        let r0x = cy;
        let r0y = 0.0_f32;
        let r0z = -sy;

        let u0x = -sp * sy;
        let u0y = cp;
        let u0z = -sp * cy;

        let rx = r0x * cr + u0x * sr;
        let ry = r0y * cr + u0y * sr;
        let rz = r0z * cr + u0z * sr;

        let ux = -r0x * sr + u0x * cr;
        let uy = -r0y * sr + u0y * cr;
        let uz = -r0z * sr + u0z * cr;

        self.cam_buf[0] = self.cam_x.pos;
        self.cam_buf[1] = self.cam_y.pos;
        self.cam_buf[2] = 0.0;
        self.cam_buf[3] = TAN_HALF_FOV;

        self.cam_buf[4] = fx;
        self.cam_buf[5] = fy;
        self.cam_buf[6] = fz;
        self.cam_buf[7] = self.scroll_z;

        self.cam_buf[8] = rx;
        self.cam_buf[9] = ry;
        self.cam_buf[10] = rz;
        self.cam_buf[11] = FLOOR_Y;

        self.cam_buf[12] = ux;
        self.cam_buf[13] = uy;
        self.cam_buf[14] = uz;
        self.cam_buf[15] = 0.0;
    }

    #[allow(clippy::too_many_arguments)]
    pub fn step_cursor_light(
        &mut self,
        safe_dt: f32,
        width: f32,
        height: f32,
        mouse_x: f32,
        mouse_y: f32,
        pointer_active: bool,
        hovered_anchor: Option<(f32, f32)>,
        snap: bool,
    ) {
        let w = width.max(1.0);
        let h = height.max(1.0);

        let mut ray_hits_floor = false;
        let mut ray_hx = self.free_x;
        let mut ray_hz = self.free_z;

        if pointer_active {
            let half_h = (h * 0.5).max(1.0);
            let us = ((mouse_x - w * 0.5) / half_h) * TAN_HALF_FOV;
            let vs = ((h * 0.5 - mouse_y) / half_h) * TAN_HALF_FOV;

            let dx = self.cam_buf[4]
                + us * self.cam_buf[8]
                + vs * self.cam_buf[12];
            let dy = self.cam_buf[5]
                + us * self.cam_buf[9]
                + vs * self.cam_buf[13];
            let dz = self.cam_buf[6]
                + us * self.cam_buf[10]
                + vs * self.cam_buf[14];
            let len_sq = dx * dx + dy * dy + dz * dz;
            let inv_len = len_sq.sqrt().max(1e-5).recip();
            let ndx = dx * inv_len;
            let ndy = dy * inv_len;
            let ndz = dz * inv_len;

            if ndy < -0.025 {
                ray_hits_floor = true;
                let raw_t = (FLOOR_Y - self.cam_y.pos) / ndy;
                let t = raw_t.clamp(0.1, 42.0);
                ray_hx = self.cam_x.pos + ndx * t;
                ray_hz = ndz * t;
            } else {
                let raw_t = (FLOOR_Y - self.cam_y.pos) / -0.032;
                let t = raw_t.clamp(0.1, 32.0);
                ray_hx = self.cam_x.pos + ndx * t;
                ray_hz = ndz * t;
            }
        }

        let glow_target;

        if let Some((ax, az)) = hovered_anchor {
            self.anchor_x = ax;
            self.anchor_z = az;
            if !self.has_floor_pos {
                self.free_x = ax;
                self.free_z = az;
                self.has_floor_pos = true;
            }
            self.anchor_blend.target = 1.0;
            glow_target = 1.0;
            if (1.0 - self.anchor_blend.pos).abs() < 0.005 {
                self.light_state = LightState::LockedObject;
            } else {
                self.light_state = LightState::ToObject;
            }
        } else if ray_hits_floor {
            if !self.has_floor_pos {
                self.free_x = ray_hx;
                self.free_z = ray_hz;
                self.has_floor_pos = true;
            } else {
                let lerp = (safe_dt * 18.0).clamp(0.0, 1.0);
                self.free_x += (ray_hx - self.free_x) * lerp;
                self.free_z += (ray_hz - self.free_z) * lerp;
            }
            self.anchor_blend.target = 0.0;
            glow_target = 1.0;
            if self.anchor_blend.pos > 0.005 {
                self.light_state = LightState::ToCursor;
            } else {
                self.light_state = LightState::Cursor;
            }
        } else {
            if pointer_active && self.has_floor_pos {
                let lerp = (safe_dt * 10.0).clamp(0.0, 1.0);
                self.free_x += (ray_hx - self.free_x) * lerp;
                self.free_z += (ray_hz - self.free_z) * lerp;
            }
            self.anchor_blend.target = 0.0;
            glow_target = 0.0;
            if self.cursor_glow.pos < 0.005 {
                self.light_state = LightState::Hidden;
                if !pointer_active {
                    self.has_floor_pos = false;
                }
            } else if self.anchor_blend.pos > 0.005 {
                self.light_state = LightState::ToCursor;
            }
        }

        self.cursor_glow.target = glow_target;
        if snap {
            self.anchor_blend.snap(self.anchor_blend.target);
            self.cursor_glow.snap(glow_target);
        } else {
            self.anchor_blend.step(safe_dt, 78.0, 17.5);
            self.cursor_glow.step(safe_dt, 90.0, 18.0);
        }

        let b = self.anchor_blend.pos.clamp(0.0, 1.0);
        let out_x = self.free_x + (self.anchor_x - self.free_x) * b;
        let out_z = self.free_z + (self.anchor_z - self.free_z) * b;

        self.cam_buf[16] = out_x;
        self.cam_buf[17] = out_z;
        self.cam_buf[18] = -1.0;
        self.cam_buf[19] = self.cursor_glow.pos.clamp(0.0, 1.0);
    }

    pub fn project_world_point(
        &self,
        wx: f32,
        wy: f32,
        wz: f32,
        width: f32,
        height: f32,
    ) -> (f32, f32, f32) {
        let w = width.max(1.0);
        let h = height.max(1.0);

        let vx = wx - self.cam_buf[0];
        let vy = wy - self.cam_buf[1];
        let vz = wz - self.cam_buf[2];

        let cx_cam = vx * self.cam_buf[8]
            + vy * self.cam_buf[9]
            + vz * self.cam_buf[10];
        let cy_cam = vx * self.cam_buf[12]
            + vy * self.cam_buf[13]
            + vz * self.cam_buf[14];
        let cz_cam = (vx * self.cam_buf[4]
            + vy * self.cam_buf[5]
            + vz * self.cam_buf[6])
            .max(1.0);

        let focal = (h * 0.5) / TAN_HALF_FOV;
        let proj = focal / cz_cam;
        let sx = w * 0.5 + cx_cam * proj;
        let sy = h * 0.5 - cy_cam * proj;

        (sx, sy, proj)
    }

    pub fn as_ptr(&self) -> *const f32 {
        self.cam_buf.as_ptr()
    }
}
