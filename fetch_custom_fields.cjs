const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient('https://dixelomafeobabahqeqg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM');

(async () => {
    try {
        const { data: event } = await supabase.from('events').select('id').eq('slug', 'uaetss-shooting-championship').single();
        if (!event) {
            console.error('Event not found');
            return;
        }
        const eventId = event.id;
        console.log('Event ID:', eventId);

        const { data: settings } = await supabase.from('global_settings').select('value').eq('key', 'event_' + eventId + '_custom_fields').single();
        const { data: accs } = await supabase.from('accreditations').select('custom_message').eq('event_id', eventId).limit(5);

        const result = {
            eventId,
            config: settings?.value ? JSON.parse(settings.value) : [],
            samples: accs.map(a => {
                try {
                    return JSON.parse(a.custom_message);
                } catch (e) {
                    return a.custom_message;
                }
            })
        };

        fs.writeFileSync('debug_custom_fields.json', JSON.stringify(result, null, 2));
        console.log('Data written to debug_custom_fields.json');
    } catch (err) {
        console.error('Error:', err);
    }
})();
