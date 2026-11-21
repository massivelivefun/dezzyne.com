use std::f32::consts::{PI, TAU};

use glam::{Quat, Vec2, Vec3A};
use rand::rngs::SmallRng;
use rand::{RngExt, SeedableRng};

use crate::grid::GridCamera;
use crate::spring::Spring;

pub const KEYPAD_FLOATS: usize = 16;

const KEYPAD_WORLD_POSITION: Vec3A = Vec3A::new(0.0, -0.56, 4.35);
const BASE_MILLIMETERS_PER_UNIT: f32 = 64.0;
const BASE_TILT_RADIANS: f32 = 0.56;
const SWING_ANGULAR_SPEED: f32 = 0.46;
const MAXIMUM_SWING_YAW: f32 = 0.62;

pub struct KeypadProp {
    is_enabled: bool,
    is_hovered: bool,
    swing_phase: f32,
    scale_spring: Spring,
    hover_glow: Spring,
    world_position: Vec3A,
    local_axis_x: Vec3A,
    local_axis_y: Vec3A,
    local_axis_z: Vec3A,
    millimeters_per_unit: f32,
    uniform_buffer: [f32; KEYPAD_FLOATS],
}

impl KeypadProp {
    pub const fn new() -> Self {
        Self {
            is_enabled: false,
            is_hovered: false,
            swing_phase: -0.45,
            scale_spring: Spring::new(0.0),
            hover_glow: Spring::new(0.0),
            world_position: KEYPAD_WORLD_POSITION,
            local_axis_x: Vec3A::X,
            local_axis_y: Vec3A::Y,
            local_axis_z: Vec3A::NEG_Z,
            millimeters_per_unit: BASE_MILLIMETERS_PER_UNIT,
            uniform_buffer: [0.0; KEYPAD_FLOATS],
        }
    }

    pub fn initialize(&mut self, is_enabled: bool, random_seed: u32) {
        self.is_enabled = is_enabled;
        self.is_hovered = false;
        self.hover_glow.snap(0.0);

        if !is_enabled {
            self.swing_phase = 0.0;
            self.scale_spring.snap(0.0);
            self.uniform_buffer = [0.0; KEYPAD_FLOATS];
            return;
        }
        let keypad_seed = u64::from(random_seed) ^ 0xA5A5_5A5A_u64;
        let mut random_generator = SmallRng::seed_from_u64(keypad_seed);
        let signed_ratio: f32 = random_generator.random_range(-1.0..=1.0);
        let reverse_swing: bool = random_generator.random_bool(0.5);
        let principal_phase = signed_ratio.clamp(-1.0, 1.0).asin();
        let raw_phase = if reverse_swing {
            PI - principal_phase
        } else {
            principal_phase
        };
        self.swing_phase = raw_phase.rem_euclid(TAU);
        self.scale_spring.position = 0.08;
        self.scale_spring.velocity = 0.0;
        self.scale_spring.target = 1.0;
    }

    pub fn clear_hover(&mut self) {
        self.is_hovered = false;
    }

    fn ray_intersects_bounds(
        &self,
        world_ray_origin: Vec3A,
        world_ray_direction: Vec3A,
    ) -> bool {
        let world_offset = world_ray_origin - self.world_position;
        let relative_origin = world_offset * self.millimeters_per_unit;
        let local_origin = Vec3A::new(
            relative_origin.dot(self.local_axis_x),
            relative_origin.dot(self.local_axis_y),
            relative_origin.dot(self.local_axis_z) + 6.0,
        );
        let local_direction = Vec3A::new(
            world_ray_direction.dot(self.local_axis_x),
            world_ray_direction.dot(self.local_axis_y),
            world_ray_direction.dot(self.local_axis_z),
        );

        let bounds_minimum = Vec3A::new(-61.0, -61.0, -0.5);
        let bounds_maximum = Vec3A::new(61.0, 61.0, 19.0);
        let mut entry_distance = 0.0_f32;
        let mut exit_distance = 1200.0_f32;

        for axis_index in 0..3 {
            let axis_origin = local_origin[axis_index];
            let axis_direction = local_direction[axis_index];
            let axis_min = bounds_minimum[axis_index];
            let axis_max = bounds_maximum[axis_index];
            let is_parallel = axis_direction.abs() < 1e-6;
            let out_of_slab = axis_origin < axis_min || axis_origin > axis_max;
            if is_parallel && out_of_slab {
                return false;
            }
            if is_parallel {
                continue;
            }
            let plane_a = (axis_min - axis_origin) / axis_direction;
            let plane_b = (axis_max - axis_origin) / axis_direction;
            entry_distance = entry_distance.max(plane_a.min(plane_b));
            exit_distance = exit_distance.min(plane_a.max(plane_b));
            if entry_distance > exit_distance {
                return false;
            }
        }

        let midpoint_distance = 0.5 * (entry_distance + exit_distance);
        let midpoint_position =
            local_origin + local_direction * midpoint_distance;
        let corner_offset =
            midpoint_position.truncate().abs() - Vec2::splat(50.0);
        let corner_distance = corner_offset.max(Vec2::ZERO).length()
            + corner_offset.max_element().min(0.0);
        corner_distance <= 11.0
    }

    pub fn hit_test(
        &self,
        screen_point: Vec2,
        viewport_size: Vec2,
        grid_camera: &GridCamera,
    ) -> bool {
        if !self.is_enabled || self.scale_spring.position < 0.15 {
            return false;
        }
        let (ray_origin, ray_direction) =
            grid_camera.screen_ray(screen_point, viewport_size);
        self.ray_intersects_bounds(ray_origin, ray_direction)
    }

    pub fn click(
        &self,
        screen_point: Vec2,
        viewport_size: Vec2,
        grid_camera: &GridCamera,
    ) -> bool {
        self.hit_test(screen_point, viewport_size, grid_camera)
    }

    pub fn step(
        &mut self,
        delta_seconds: f32,
        motion_scale: f32,
        viewport_size: Vec2,
        pointer_position: Vec2,
        pointer_active: bool,
        grid_camera: &GridCamera,
    ) {
        if !self.is_enabled {
            self.is_hovered = false;
            self.uniform_buffer[7] = 0.0;
            return;
        }

        if motion_scale <= 0.001 {
            self.scale_spring.snap(1.0);
        } else {
            self.scale_spring.step(delta_seconds, 120.0, 19.5);
            let phase_step =
                delta_seconds * SWING_ANGULAR_SPEED * motion_scale;
            self.swing_phase = (self.swing_phase + phase_step).rem_euclid(TAU);
        }

        let clamped_scale = self.scale_spring.position.clamp(0.05, 1.15);
        self.millimeters_per_unit = BASE_MILLIMETERS_PER_UNIT / clamped_scale;

        let vertical_bob =
            (self.swing_phase * 2.0).cos() * 0.025 * motion_scale;
        self.world_position =
            KEYPAD_WORLD_POSITION + Vec3A::new(0.0, vertical_bob, 0.0);

        let yaw_radians =
            self.swing_phase.sin() * MAXIMUM_SWING_YAW * motion_scale;
        let tilt_radians = BASE_TILT_RADIANS
            + (self.swing_phase * 2.0).cos() * 0.035 * motion_scale;
        let (tilt_sine, tilt_cosine) = tilt_radians.sin_cos();

        let yaw_rotation = Quat::from_rotation_y(yaw_radians);
        self.local_axis_x = (yaw_rotation * Vec3A::X).normalize_or_zero();
        self.local_axis_y = (yaw_rotation
            * Vec3A::new(0.0, tilt_cosine, tilt_sine))
        .normalize_or_zero();
        self.local_axis_z = (yaw_rotation
            * Vec3A::new(0.0, tilt_sine, -tilt_cosine))
        .normalize_or_zero();

        self.is_hovered = pointer_active
            && self.hit_test(pointer_position, viewport_size, grid_camera);

        self.hover_glow.target = if self.is_hovered { 1.0 } else { 0.0 };
        self.hover_glow.step(delta_seconds, 85.0, 18.0);

        let visibility = self.scale_spring.position.clamp(0.0, 1.0);
        let hover_intensity = self.hover_glow.position.clamp(0.0, 1.0);

        self.uniform_buffer[0] = self.world_position.x;
        self.uniform_buffer[1] = self.world_position.y;
        self.uniform_buffer[2] = self.world_position.z;
        self.uniform_buffer[3] = self.millimeters_per_unit;

        self.uniform_buffer[4] = self.local_axis_x.x;
        self.uniform_buffer[5] = self.local_axis_x.y;
        self.uniform_buffer[6] = self.local_axis_x.z;
        self.uniform_buffer[7] = 1.0;

        self.uniform_buffer[8] = self.local_axis_y.x;
        self.uniform_buffer[9] = self.local_axis_y.y;
        self.uniform_buffer[10] = self.local_axis_y.z;
        self.uniform_buffer[11] = hover_intensity;

        self.uniform_buffer[12] = self.local_axis_z.x;
        self.uniform_buffer[13] = self.local_axis_z.y;
        self.uniform_buffer[14] = self.local_axis_z.z;
        self.uniform_buffer[15] = visibility;
    }

    pub fn is_hovered(&self) -> bool {
        self.is_hovered
    }

    pub fn hovered_floor_anchor(&self) -> Option<Vec2> {
        if !self.is_enabled || !self.is_hovered {
            return None;
        }
        Some(Vec2::new(self.world_position.x, self.world_position.z))
    }

    pub fn as_pointer(&self) -> *const f32 {
        self.uniform_buffer.as_ptr()
    }
}
