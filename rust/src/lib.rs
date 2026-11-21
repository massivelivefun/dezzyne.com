#![deny(unsafe_code)]

mod engine;
mod grid;
mod keypad;
mod portal;
mod spring;

#[allow(unsafe_code)]
mod ffi {
    use crate::engine::{with_engine, with_engine_mut};

    #[no_mangle]
    pub extern "C" fn initialize_scene(
        width: f32,
        height: f32,
        scene_mode: u32,
        random_seed: u32,
    ) {
        with_engine_mut(|engine| {
            engine.initialize(width, height, scene_mode, random_seed);
        });
    }

    #[no_mangle]
    pub extern "C" fn resize_scene(width: f32, height: f32) {
        with_engine_mut(|engine| engine.resize(width, height));
    }

    #[no_mangle]
    pub extern "C" fn pointer_move(pointer_x: f32, pointer_y: f32) {
        with_engine_mut(|engine| engine.pointer_move(pointer_x, pointer_y));
    }

    #[no_mangle]
    pub extern "C" fn touch_move(
        camera_x: f32,
        camera_y: f32,
        light_x: f32,
        light_y: f32,
    ) {
        with_engine_mut(|engine| {
            engine.touch_move(camera_x, camera_y, light_x, light_y);
        });
    }

    #[no_mangle]
    pub extern "C" fn pointer_leave() {
        with_engine_mut(|engine| engine.pointer_leave());
    }

    #[no_mangle]
    pub extern "C" fn click_stage(pointer_x: f32, pointer_y: f32) -> i32 {
        with_engine_mut(|engine| engine.click_stage(pointer_x, pointer_y))
    }

    #[no_mangle]
    pub extern "C" fn is_interactive_hovered() -> u32 {
        with_engine(|engine| u32::from(engine.is_interactive_hovered()))
    }

    #[no_mangle]
    pub extern "C" fn step_scene(
        delta_seconds: f32,
        motion_scale: f32,
        entities_ready: u32,
    ) -> u32 {
        with_engine_mut(|engine| {
            engine.step(delta_seconds, motion_scale, entities_ready != 0)
        })
    }

    #[no_mangle]
    pub extern "C" fn get_camera_pointer() -> *const f32 {
        with_engine(|engine| engine.grid_camera.as_pointer())
    }

    #[no_mangle]
    pub extern "C" fn get_keypad_pointer() -> *const f32 {
        with_engine(|engine| engine.keypad_prop.as_pointer())
    }

    #[no_mangle]
    pub extern "C" fn get_portal_count() -> usize {
        with_engine(|engine| engine.portal_group.portal_count())
    }

    #[no_mangle]
    pub extern "C" fn get_portals_pointer() -> *const f32 {
        with_engine(|engine| engine.portal_group.portals_pointer())
    }

    #[no_mangle]
    pub extern "C" fn get_rings_pointer() -> *const f32 {
        with_engine(|engine| engine.portal_group.rings_pointer())
    }

    #[no_mangle]
    pub extern "C" fn get_particles_pointer() -> *const f32 {
        with_engine(|engine| engine.portal_group.particles_pointer())
    }

    #[no_mangle]
    pub extern "C" fn get_particle_count() -> usize {
        with_engine(|engine| engine.portal_group.total_particle_count())
    }

    #[no_mangle]
    pub extern "C" fn get_portal_metadata_pointer() -> *const u32 {
        with_engine(|engine| engine.portal_group.metadata_pointer())
    }
}
