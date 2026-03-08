export namespace models {
	
	export class GeneratorOptions {
	    length: number;
	    use_symbols: boolean;
	    use_numbers: boolean;
	    use_uppercase: boolean;
	
	    static createFrom(source: any = {}) {
	        return new GeneratorOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.length = source["length"];
	        this.use_symbols = source["use_symbols"];
	        this.use_numbers = source["use_numbers"];
	        this.use_uppercase = source["use_uppercase"];
	    }
	}
	export class PasswordHistory {
	    id: string;
	    record_id: string;
	    password: string;
	    replaced_at: number;
	
	    static createFrom(source: any = {}) {
	        return new PasswordHistory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.record_id = source["record_id"];
	        this.password = source["password"];
	        this.replaced_at = source["replaced_at"];
	    }
	}
	export class RecordDetail {
	    id: string;
	    name: string;
	    username_masked: string;
	    created_at: number;
	    updated_at: number;
	    username: string;
	    password: string;
	    url?: string;
	    notes?: string;
	    tags?: string[];
	
	    static createFrom(source: any = {}) {
	        return new RecordDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.username_masked = source["username_masked"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.url = source["url"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	    }
	}
	export class RecordInput {
	    name: string;
	    username: string;
	    password: string;
	    url?: string;
	    notes?: string;
	    tags?: string[];
	
	    static createFrom(source: any = {}) {
	        return new RecordInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.url = source["url"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	    }
	}
	export class RecordSummary {
	    id: string;
	    name: string;
	    username_masked: string;
	    created_at: number;
	    updated_at: number;
	
	    static createFrom(source: any = {}) {
	        return new RecordSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.username_masked = source["username_masked"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}

}

