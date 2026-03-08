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
	export class RecordDetail {
	    id: string;
	    type: string;
	    name: string;
	    username_masked: string;
	    created_at: number;
	    updated_at: number;
	    username?: string;
	    password?: string;
	    secret_key?: string;
	    url?: string;
	    notes?: string;
	    tags?: string[];
	
	    static createFrom(source: any = {}) {
	        return new RecordDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.name = source["name"];
	        this.username_masked = source["username_masked"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.secret_key = source["secret_key"];
	        this.url = source["url"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	    }
	}
	export class RecordInput {
	    type: string;
	    name: string;
	    username?: string;
	    password?: string;
	    secret_key?: string;
	    url?: string;
	    notes?: string;
	    tags?: string[];
	
	    static createFrom(source: any = {}) {
	        return new RecordInput(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.name = source["name"];
	        this.username = source["username"];
	        this.password = source["password"];
	        this.secret_key = source["secret_key"];
	        this.url = source["url"];
	        this.notes = source["notes"];
	        this.tags = source["tags"];
	    }
	}
	export class RecordSummary {
	    id: string;
	    type: string;
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
	        this.type = source["type"];
	        this.name = source["name"];
	        this.username_masked = source["username_masked"];
	        this.created_at = source["created_at"];
	        this.updated_at = source["updated_at"];
	    }
	}
	export class SecretHistory {
	    id: string;
	    record_id: string;
	    secret: string;
	    replaced_at: number;
	
	    static createFrom(source: any = {}) {
	        return new SecretHistory(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.record_id = source["record_id"];
	        this.secret = source["secret"];
	        this.replaced_at = source["replaced_at"];
	    }
	}

}

